mod core;
mod model;
mod stream;

#[cfg(test)]
mod tests;

use crate::model::ParserError;
use crate::stream::StreamingSaveParser;
use wasm_bindgen::prelude::*;

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
