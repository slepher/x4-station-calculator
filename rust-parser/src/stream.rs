use crate::core::SaveParserCore;
use crate::model::{ParsePhase, ParserError, ProgressInfo, SaveArchive};
use quick_xml::encoding::Decoder;
use std::collections::HashMap;

const CLI_PROGRESS_INTERVAL_MS: f64 = 1000.0;

#[cfg(target_arch = "wasm32")]
fn now_ms() -> f64 {
    js_sys::Date::now()
}

#[cfg(not(target_arch = "wasm32"))]
fn now_ms() -> f64 {
    use std::time::{SystemTime, UNIX_EPOCH};

    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs_f64() * 1000.0)
        .unwrap_or(0.0)
}

fn parse_attrs<'a>(
    e: &'a quick_xml::events::BytesStart<'a>,
    decoder: Decoder,
) -> Result<HashMap<String, String>, ParserError> {
    let mut attrs = HashMap::new();
    for attr in e.attributes().with_checks(false) {
        let attr =
            attr.map_err(|err| ParserError::parse_error(format!("attribute parse error: {err}")))?;
        let key = String::from_utf8_lossy(attr.key.as_ref()).to_lowercase();
        let value = attr
            .decode_and_unescape_value(decoder)
            .map_err(|err| ParserError::parse_error(format!("attribute decode error: {err}")))?
            .into_owned();
        attrs.insert(key, value);
    }
    Ok(attrs)
}

pub(crate) struct StreamingSaveParser {
    buffer: Vec<u8>,
    committed: usize,
    total_parsed: usize,
    input_bytes_received: usize,
    expected_total_bytes: usize,
    phase: ParsePhase,
    input_complete: bool,
    done: bool,
    error: Option<ParserError>,
    core: SaveParserCore,
    last_reported_phase: Option<ParsePhase>,
    last_reported_percent_bucket: Option<u32>,
    last_reported_done: bool,
    last_reported_has_error: bool,
    last_cli_reported_at_ms: Option<f64>,
}

impl StreamingSaveParser {
    pub(crate) fn new(expected_version: Option<String>) -> Self {
        Self {
            buffer: Vec::new(),
            committed: 0,
            total_parsed: 0,
            input_bytes_received: 0,
            expected_total_bytes: 0,
            phase: ParsePhase::Receiving,
            input_complete: false,
            done: false,
            error: None,
            core: SaveParserCore::new(expected_version),
            last_reported_phase: None,
            last_reported_percent_bucket: None,
            last_reported_done: false,
            last_reported_has_error: false,
            last_cli_reported_at_ms: None,
        }
    }

    pub(crate) fn set_expected_total_bytes(&mut self, total: usize) {
        self.expected_total_bytes = total;
    }

    pub(crate) fn set_expected_version(&mut self, version: Option<String>) {
        self.core.set_expected_version(version);
    }

    pub(crate) fn push_chunk(&mut self, chunk: &[u8]) {
        if self.done || self.error.is_some() {
            return;
        }
        if !chunk.is_empty() {
            if self.committed > 0 {
                self.buffer.drain(..self.committed);
                self.committed = 0;
            }
            self.buffer.extend_from_slice(chunk);
            self.input_bytes_received += chunk.len();
            if self.phase == ParsePhase::Receiving {
                self.phase = ParsePhase::Parsing;
            }
        }
    }

    pub(crate) fn finish_input(&mut self) {
        self.input_complete = true;
    }

    fn current_progress_info(&self) -> ProgressInfo {
        let buffered = self.buffer.len().saturating_sub(self.committed);
        let progress_total = if self.expected_total_bytes > 0 {
            self.expected_total_bytes
        } else {
            self.input_bytes_received
        };
        let raw_pct = if progress_total == 0 {
            0.0
        } else {
            self.total_parsed as f64 / progress_total as f64 * 100.0
        };
        let pct = match self.phase {
            ParsePhase::Receiving => 0.0,
            ParsePhase::Parsing => raw_pct.clamp(0.0, 99.0),
            ParsePhase::Finalizing => 99.0,
            ParsePhase::Done => 100.0,
            ParsePhase::Error => raw_pct.clamp(0.0, 100.0),
        };

        ProgressInfo {
            phase: self.phase,
            input_bytes_total: self.input_bytes_received,
            parsed_bytes_total: self.total_parsed,
            buffered_bytes: buffered,
            expected_total_bytes: self.expected_total_bytes,
            percent: pct,
            tag_count: self.core.tag_count(),
            sector_count: self.core.sector_count(),
            done: self.done,
            input_complete: self.input_complete,
            error: self.error.as_ref().map(|e| e.to_string()),
            error_detail: self.error.as_ref().map(|e| e.detail.clone()),
        }
    }

    pub(crate) fn progress_json(&self) -> String {
        serde_json::to_string(&self.current_progress_info()).unwrap_or_default()
    }

    pub(crate) fn take_cli_progress_json(&mut self) -> String {
        let progress = self.current_progress_info();
        let current_bucket = progress.percent.floor() as u32;
        let has_error = progress.error.is_some();
        let force_report = self.last_reported_phase.is_none()
            || self.last_reported_phase != Some(progress.phase)
            || self.last_reported_done != progress.done
            || self.last_reported_has_error != has_error
            || matches!(progress.phase, ParsePhase::Finalizing | ParsePhase::Done | ParsePhase::Error);

        let now = now_ms();
        let interval_elapsed = self
            .last_cli_reported_at_ms
            .map(|last| now - last >= CLI_PROGRESS_INTERVAL_MS)
            .unwrap_or(true);
        let bucket_changed = self.last_reported_percent_bucket != Some(current_bucket);
        let should_report = force_report || (bucket_changed && interval_elapsed);

        if !should_report {
            return String::new();
        }

        self.last_reported_phase = Some(progress.phase);
        self.last_reported_percent_bucket = Some(current_bucket);
        self.last_reported_done = progress.done;
        self.last_reported_has_error = has_error;
        self.last_cli_reported_at_ms = Some(now);

        serde_json::to_string(&progress).unwrap_or_default()
    }

    pub(crate) fn pump(&mut self, max_events: usize) -> bool {
        if self.done || self.error.is_some() {
            return false;
        }

        let available = self.buffer.len().saturating_sub(self.committed);
        if available == 0 {
            if self.input_complete {
                if self.core.has_open_path() {
                    self.phase = ParsePhase::Error;
                    self.error = Some(ParserError::parse_error(format!(
                        "XML ended before all tags were closed; remaining open path: {:?}",
                        self.core.open_path()
                    )));
                    return false;
                }
                self.phase = ParsePhase::Finalizing;
                self.done = true;
                self.phase = ParsePhase::Done;
            }
            return false;
        }

        let start = self.committed;
        let mut reader = quick_xml::Reader::from_reader(&self.buffer[start..]);
        reader.config_mut().trim_text(false);
        reader.config_mut().check_end_names = false;
        reader.config_mut().allow_unmatched_ends = true;

        let mut events: Vec<quick_xml::events::Event<'static>> = Vec::new();
        let mut processed = 0usize;
        let mut hit_eof = false;
        let mut last_good_pos = 0usize;
        let mut waiting_for_more_input = false;

        while processed < max_events {
            let mut event_buf = Vec::new();
            match reader.read_event_into(&mut event_buf) {
                Ok(quick_xml::events::Event::Start(e)) => {
                    events.push(quick_xml::events::Event::Start(e.into_owned()));
                    last_good_pos = reader.buffer_position() as usize;
                    processed += 1;
                }
                Ok(quick_xml::events::Event::Empty(e)) => {
                    events.push(quick_xml::events::Event::Empty(e.into_owned()));
                    last_good_pos = reader.buffer_position() as usize;
                    processed += 1;
                }
                Ok(quick_xml::events::Event::End(e)) => {
                    events.push(quick_xml::events::Event::End(e.into_owned()));
                    last_good_pos = reader.buffer_position() as usize;
                    processed += 1;
                }
                Ok(quick_xml::events::Event::Text(_))
                | Ok(quick_xml::events::Event::CData(_))
                | Ok(quick_xml::events::Event::Comment(_))
                | Ok(quick_xml::events::Event::Decl(_))
                | Ok(quick_xml::events::Event::PI(_))
                | Ok(quick_xml::events::Event::DocType(_)) => {
                    last_good_pos = reader.buffer_position() as usize;
                    processed += 1;
                }
                Ok(quick_xml::events::Event::Eof) => {
                    hit_eof = true;
                    break;
                }
                Err(err) => {
                    if self.input_complete {
                        self.phase = ParsePhase::Error;
                        self.error = Some(ParserError::parse_error(format!(
                            "XML parse error at {} MB: {} (path: {:?})",
                            self.total_parsed / (1024 * 1024),
                            err,
                            self.core
                                .open_path()
                                .iter()
                                .rev()
                                .take(5)
                                .collect::<Vec<_>>()
                        )));
                        return false;
                    }
                    waiting_for_more_input = true;
                    break;
                }
            }
        }

        self.committed = start + last_good_pos;
        self.total_parsed += last_good_pos;

        for event in events {
            if self.error.is_some() {
                return false;
            }
            let decoder = reader.decoder();
            let result = match event {
                quick_xml::events::Event::Start(e) => {
                    let n = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                    parse_attrs(&e, decoder).and_then(|a| self.core.open(&n, &a))
                }
                quick_xml::events::Event::Empty(e) => {
                    let n = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                    match parse_attrs(&e, decoder).and_then(|a| self.core.open(&n, &a)) {
                        Ok(()) => self.core.close(&n),
                        Err(err) => Err(err),
                    }
                }
                quick_xml::events::Event::End(e) => {
                    let n = String::from_utf8_lossy(e.name().as_ref()).to_lowercase();
                    self.core.close(&n)
                }
                _ => Ok(()),
            };

            if let Err(err) = result {
                self.phase = ParsePhase::Error;
                self.error = Some(err);
                return false;
            }
        }

        if hit_eof && self.input_complete {
            if self.core.has_open_path() {
                self.phase = ParsePhase::Error;
                self.error = Some(ParserError::parse_error(format!(
                    "XML reached EOF with unclosed tags remaining: {:?}",
                    self.core.open_path()
                )));
                return false;
            }
            self.phase = ParsePhase::Finalizing;
            self.done = true;
            self.phase = ParsePhase::Done;
            return false;
        }

        if !self.input_complete && (hit_eof || waiting_for_more_input) {
            return false;
        }

        self.buffer.len() > self.committed
    }

    pub(crate) fn finish_archive(&self, filename: &str) -> Result<SaveArchive, ParserError> {
        if let Some(err) = &self.error {
            return Err(err.clone());
        }
        if !self.done {
            return Err(ParserError::parse_error(
                "parser is not done yet; keep calling pump()",
            ));
        }
        self.core.finish_archive(filename)
    }
}
