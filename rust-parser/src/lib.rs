mod blueprints;
mod core;
mod faction;
mod model;
mod research;
mod stream;
mod terraforming;

#[cfg(test)]
mod tests;

use crate::model::ParserError;
use crate::stream::StreamingSaveParser;
use wasm_bindgen::prelude::*;

const UNIVERSE_START: &[u8] = b"<universe";
const UNIVERSE_END: &[u8] = b"</universe>";

#[wasm_bindgen]
pub struct UniverseXmlCutter {
    pending: Vec<u8>,
    started: bool,
    done: bool,
}

#[wasm_bindgen]
impl UniverseXmlCutter {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            pending: Vec::new(),
            started: false,
            done: false,
        }
    }

    pub fn push_chunk(&mut self, chunk: &[u8]) -> Vec<u8> {
        if self.done {
            return Vec::new();
        }

        self.pending.extend_from_slice(chunk);

        if !self.started {
            let start = (0..=self.pending.len().saturating_sub(UNIVERSE_START.len())).find(|&i| {
                self.pending[i..].starts_with(UNIVERSE_START)
                    && self
                        .pending
                        .get(i + UNIVERSE_START.len())
                        .is_some_and(|b| b.is_ascii_whitespace() || *b == b'>' || *b == b'/')
            });
            if start.is_some() {
                self.started = true;
            } else {
                let keep = UNIVERSE_START.len().min(self.pending.len());
                let emit = self.pending.len() - keep;
                return self.pending.drain(..emit).collect();
            }
        }

        if let Some(end) = self
            .pending
            .windows(UNIVERSE_END.len())
            .position(|window| window == UNIVERSE_END)
        {
            let end = end + UNIVERSE_END.len();
            self.done = true;
            let mut output: Vec<u8> = self.pending.drain(..end).collect();
            output.extend_from_slice(b"\n</savegame>\n");
            return output;
        }

        let emit = self.pending.len().saturating_sub(UNIVERSE_END.len() - 1);
        self.pending.drain(..emit).collect()
    }

    pub fn is_done(&self) -> bool {
        self.done
    }

    pub fn finish(&self) -> Result<(), JsValue> {
        if self.done {
            Ok(())
        } else if self.started {
            Err(JsValue::from_str("input ended before </universe>"))
        } else {
            Err(JsValue::from_str("<universe> was not found"))
        }
    }
}

#[wasm_bindgen]
pub struct SaveParser {
    inner: StreamingSaveParser,
}

#[wasm_bindgen]
impl SaveParser {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            inner: StreamingSaveParser::new(None),
        }
    }

    pub fn set_expected_total_bytes(&mut self, total: usize) {
        self.inner.set_expected_total_bytes(total);
    }

    pub fn set_expected_total_sectors(&mut self, total: usize) {
        self.inner.set_expected_total_sectors(total);
    }

    pub fn set_expected_version(&mut self, version: &str) {
        self.inner.set_expected_version(Some(version.to_string()));
    }

    pub fn push_chunk(&mut self, chunk: &[u8]) {
        self.inner.push_chunk(chunk);
    }

    pub fn finish_input(&mut self) {
        self.inner.finish_input();
    }

    pub fn progress_json(&self) -> String {
        self.inner.progress_json()
    }

    pub fn take_cli_progress_json(&mut self) -> String {
        self.inner.take_cli_progress_json()
    }

    pub fn pump(&mut self, max_events: usize) -> bool {
        self.inner.pump(max_events)
    }

    pub fn finish(&self, filename: &str) -> Result<String, JsValue> {
        self.inner
            .finish_archive(filename)
            .and_then(|archive| {
                serde_json::to_string(&archive)
                    .map_err(|e| ParserError::parse_error(format!("serialize error: {e}")))
            })
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }
}
