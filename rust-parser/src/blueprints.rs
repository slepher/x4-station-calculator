use std::collections::{HashMap, VecDeque};

#[derive(Clone, Default)]
pub(crate) struct BlueprintsParser {
    player_blueprints: Vec<String>,
    in_player_blueprints: bool,
}

impl BlueprintsParser {
    pub(crate) fn blueprints(&self) -> &Vec<String> {
        &self.player_blueprints
    }

    pub(crate) fn open(
        &mut self,
        name: &str,
        attrs: &HashMap<String, String>,
        _path: &VecDeque<String>,
    ) {
        if name == "blueprints" {
            self.in_player_blueprints = true;
        }

        if name == "blueprint" && self.in_player_blueprints {
            if let Some(ware) = attrs.get("ware").cloned() {
                self.player_blueprints.push(ware);
            }
        }
    }

    pub(crate) fn close(&mut self, name: &str) {
        if name == "blueprints" && self.in_player_blueprints {
            self.in_player_blueprints = false;
        }
    }
}
