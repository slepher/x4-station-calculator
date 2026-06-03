use std::collections::{HashMap, VecDeque};

#[derive(Clone, Default)]
pub(crate) struct FactionParser {
    player_relations: HashMap<String, f64>,
    player_licences: HashMap<String, Vec<String>>,
    in_player_faction: bool,
}

impl FactionParser {
    pub(crate) fn relations(&self) -> &HashMap<String, f64> {
        &self.player_relations
    }

    pub(crate) fn licences(&self) -> &HashMap<String, Vec<String>> {
        &self.player_licences
    }

    pub(crate) fn open(
        &mut self,
        name: &str,
        attrs: &HashMap<String, String>,
        _path: &VecDeque<String>,
    ) {
        if name == "faction" && attrs.get("id").map(|s| s.as_str()) == Some("player") {
            self.in_player_faction = true;
        }

        if self.in_player_faction && name == "relation" {
            if let Some(faction) = attrs.get("faction").cloned() {
                if let Some(rel_str) = attrs.get("relation") {
                    if let Ok(value) = rel_str.parse::<f64>() {
                        self.player_relations.insert(faction, value);
                    }
                }
            }
        }

        if self.in_player_faction && name == "licence" {
            if let Some(licence_type) = attrs.get("type").cloned() {
                if let Some(factions_str) = attrs.get("factions") {
                    let existing = self.player_licences.entry(licence_type).or_default();
                    for f in factions_str.split_whitespace() {
                        let f = f.to_string();
                        if !existing.contains(&f) {
                            existing.push(f);
                        }
                    }
                }
            }
        }
    }

    pub(crate) fn close(&mut self, name: &str) {
        if name == "faction" && self.in_player_faction {
            self.in_player_faction = false;
        }
    }
}
