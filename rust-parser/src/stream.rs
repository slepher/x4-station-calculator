use crate::core::SaveParserCore;
use crate::model::{ParsePhase, ParserError, ProgressInfo, SaveArchive};
use flate2::{Decompress, FlushDecompress, Status};
use quick_xml::encoding::Decoder;
use std::collections::HashMap;

const CLI_PROGRESS_INTERVAL_MS: f64 = 1000.0;
const DECOMPRESS_OUTPUT_CHUNK_SIZE: usize = 64 * 1024;

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

fn parse_gzip_header_length(bytes: &[u8]) -> Result<Option<usize>, ParserError> {
    if bytes.len() < 10 {
        return Ok(None);
    }
    if bytes[0] != 0x1f || bytes[1] != 0x8b {
        return Err(ParserError::parse_error("invalid gzip header magic"));
    }
    if bytes[2] != 8 {
        return Err(ParserError::parse_error(
            "unsupported gzip compression method",
        ));
    }

    let flags = bytes[3];
    let mut offset = 10usize;

    if flags & 0x04 != 0 {
        if bytes.len() < offset + 2 {
            return Ok(None);
        }
        let xlen = u16::from_le_bytes([bytes[offset], bytes[offset + 1]]) as usize;
        offset += 2;
        if bytes.len() < offset + xlen {
            return Ok(None);
        }
        offset += xlen;
    }

    if flags & 0x08 != 0 {
        while offset < bytes.len() && bytes[offset] != 0 {
            offset += 1;
        }
        if offset >= bytes.len() {
            return Ok(None);
        }
        offset += 1;
    }

    if flags & 0x10 != 0 {
        while offset < bytes.len() && bytes[offset] != 0 {
            offset += 1;
        }
        if offset >= bytes.len() {
            return Ok(None);
        }
        offset += 1;
    }

    if flags & 0x02 != 0 {
        if bytes.len() < offset + 2 {
            return Ok(None);
        }
        offset += 2;
    }

    Ok(Some(offset))
}

struct GzipInputState {
    decompressor: Decompress,
    header_parsed: bool,
    pending_input: Vec<u8>,
    trailer: Vec<u8>,
    finished: bool,
}

enum InputMode {
    Detecting(Vec<u8>),
    Plain,
    Gzip(GzipInputState),
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
    input_mode: InputMode,
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
            input_mode: InputMode::Detecting(Vec::new()),
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
            self.input_bytes_received += chunk.len();
            if self.phase == ParsePhase::Receiving {
                self.phase = ParsePhase::Parsing;
            }
            self.push_input_bytes(chunk);
        }
    }

    pub(crate) fn finish_input(&mut self) {
        if self.done || self.error.is_some() {
            self.input_complete = true;
            return;
        }
        match &self.input_mode {
            InputMode::Detecting(_) => {
                let sniffed = match std::mem::replace(&mut self.input_mode, InputMode::Plain) {
                    InputMode::Detecting(bytes) => bytes,
                    _ => Vec::new(),
                };
                if !sniffed.is_empty() {
                    self.append_plain_input(&sniffed);
                }
            }
            InputMode::Gzip(_) => {
                if let Err(err) = self.finish_gzip_input() {
                    self.phase = ParsePhase::Error;
                    self.error = Some(err);
                }
            }
            InputMode::Plain => {}
        }
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
            || matches!(
                progress.phase,
                ParsePhase::Finalizing | ParsePhase::Done | ParsePhase::Error
            );

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

            if self.core.should_stop_after_universe() {
                self.phase = ParsePhase::Finalizing;
                self.done = true;
                self.phase = ParsePhase::Done;
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

    fn push_input_bytes(&mut self, chunk: &[u8]) {
        if matches!(self.input_mode, InputMode::Plain) {
            self.append_plain_input(chunk);
            return;
        }

        if matches!(self.input_mode, InputMode::Gzip(_)) {
            if let Err(err) = self.feed_gzip_input(chunk, false) {
                self.phase = ParsePhase::Error;
                self.error = Some(err);
            }
            return;
        }

        if let InputMode::Detecting(sniffed) = &mut self.input_mode {
            sniffed.extend_from_slice(chunk);
            if sniffed.len() < 2 {
                return;
            }
        }

        let sniffed = match std::mem::replace(&mut self.input_mode, InputMode::Plain) {
            InputMode::Detecting(bytes) => bytes,
            other => {
                self.input_mode = other;
                return;
            }
        };

        let is_gzip = sniffed.len() >= 2 && sniffed[0] == 0x1f && sniffed[1] == 0x8b;
        if is_gzip {
            self.input_mode = InputMode::Gzip(GzipInputState {
                decompressor: Decompress::new(false),
                header_parsed: false,
                pending_input: Vec::new(),
                trailer: Vec::new(),
                finished: false,
            });
            if let Err(err) = self.feed_gzip_input(&sniffed, false) {
                self.phase = ParsePhase::Error;
                self.error = Some(err);
            }
        } else {
            self.input_mode = InputMode::Plain;
            self.append_plain_input(&sniffed);
        }
    }

    fn append_plain_input(&mut self, chunk: &[u8]) {
        if self.committed > 0 {
            self.buffer.drain(..self.committed);
            self.committed = 0;
        }
        self.buffer.extend_from_slice(chunk);
    }

    fn feed_gzip_input(&mut self, chunk: &[u8], finish: bool) -> Result<(), ParserError> {
        {
            let InputMode::Gzip(state) = &mut self.input_mode else {
                return Err(ParserError::parse_error(
                    "gzip input received without gzip mode",
                ));
            };
            if !chunk.is_empty() {
                state.pending_input.extend_from_slice(chunk);
            }
            if !state.header_parsed {
                let header_len = match parse_gzip_header_length(&state.pending_input)? {
                    Some(len) => len,
                    None => {
                        if finish {
                            return Err(ParserError::parse_error("gzip header incomplete"));
                        }
                        return Ok(());
                    }
                };
                state.pending_input.drain(..header_len);
                state.header_parsed = true;
            }
        }

        loop {
            let mut output = [0u8; DECOMPRESS_OUTPUT_CHUNK_SIZE];
            let mut produced_bytes: Vec<u8> = Vec::new();
            let mut should_continue = false;
            let mut finished_stream = false;

            {
                let InputMode::Gzip(state) = &mut self.input_mode else {
                    return Err(ParserError::parse_error(
                        "gzip input received without gzip mode",
                    ));
                };

                if state.finished {
                    if !state.pending_input.is_empty() {
                        state.trailer.extend_from_slice(&state.pending_input);
                        state.pending_input.clear();
                    }
                    finished_stream = true;
                } else {
                    let before_in = state.decompressor.total_in();
                    let before_out = state.decompressor.total_out();
                    let status = state
                        .decompressor
                        .decompress(
                            &state.pending_input,
                            &mut output,
                            if finish {
                                FlushDecompress::Finish
                            } else {
                                FlushDecompress::None
                            },
                        )
                        .map_err(|err| {
                            ParserError::parse_error(format!("gzip decode error: {err}"))
                        })?;
                    let consumed = (state.decompressor.total_in() - before_in) as usize;
                    let produced = (state.decompressor.total_out() - before_out) as usize;

                    if produced > 0 {
                        produced_bytes.extend_from_slice(&output[..produced]);
                    }
                    state.pending_input.drain(..consumed);

                    if matches!(status, Status::StreamEnd) {
                        state.finished = true;
                        if !state.pending_input.is_empty() {
                            state.trailer.extend_from_slice(&state.pending_input);
                            state.pending_input.clear();
                        }
                        finished_stream = true;
                    } else if consumed == 0 && produced == 0 {
                        if finish {
                            return Err(ParserError::parse_error(
                                "gzip stream ended before decompression completed",
                            ));
                        }
                    } else {
                        should_continue = !state.pending_input.is_empty()
                            || produced == DECOMPRESS_OUTPUT_CHUNK_SIZE
                            || (finish && (consumed > 0 || produced > 0));
                    }
                }

                if finished_stream {
                    if state.trailer.len() < 8 {
                        if finish {
                            return Err(ParserError::parse_error("gzip trailer incomplete"));
                        }
                    } else if state.trailer.len() > 8 {
                        return Err(ParserError::parse_error(
                            "multiple gzip members are not supported",
                        ));
                    }
                }
            }

            if !produced_bytes.is_empty() {
                self.append_plain_input(&produced_bytes);
            }

            if finished_stream {
                let InputMode::Gzip(state) = &self.input_mode else {
                    return Err(ParserError::parse_error(
                        "gzip state lost after decompression",
                    ));
                };
                if state.trailer.len() == 8 {
                    return Ok(());
                }
            }

            if !should_continue {
                return Ok(());
            }
        }
    }

    fn finish_gzip_input(&mut self) -> Result<(), ParserError> {
        self.feed_gzip_input(&[], true)
    }
}
