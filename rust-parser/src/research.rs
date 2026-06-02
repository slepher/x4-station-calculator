use crate::model::SaveResearchRuntime;
use std::collections::{HashMap, VecDeque};

#[derive(Clone, Default)]
pub(crate) struct ResearchParser {
    runtime: SaveResearchRuntime,
    in_player_researchables: bool,
    in_player_completed_research: bool,
}

impl ResearchParser {
    pub(crate) fn runtime(&self) -> &SaveResearchRuntime {
        &self.runtime
    }

    pub(crate) fn open(
        &mut self,
        name: &str,
        attrs: &HashMap<String, String>,
        path: &VecDeque<String>,
        is_inside_player: bool,
        is_inside_research_production: bool,
    ) {
        if name == "entries"
            && is_inside_player
            && attrs.get("type").map_or(false, |t| t == "researchables")
        {
            self.in_player_researchables = true;
        }

        if name == "entry" && self.in_player_researchables {
            if let Some(id) = attrs.get("id").cloned() {
                if id.starts_with("research_") {
                    self.runtime.visible_ids.push(id);
                }
            }
        }

        if name == "research" && is_inside_player {
            if attrs.contains_key("ware") {
                if self.in_player_completed_research
                    && attrs.get("method").map_or(false, |m| m == "research")
                {
                    if let Some(ware) = attrs.get("ware").cloned() {
                        if ware.starts_with("research_") {
                            self.runtime.completed_ids.push(ware);
                        }
                    }
                }
            } else {
                self.in_player_completed_research = true;
            }
        }

        if name == "queue" && is_inside_research_production {
            let parent_is_production = path.len() >= 2
                && path.get(path.len() - 2).map(|s| s.as_str()) == Some("production");
            if parent_is_production && attrs.get("method").map_or(false, |m| m == "research") {
                if let Some(ware) = attrs.get("ware").cloned() {
                    if ware.starts_with("research_") {
                        self.runtime.active_id = Some(ware);
                    }
                }
            }
        }
    }

    pub(crate) fn close(&mut self, name: &str, path: &VecDeque<String>) {
        if name == "entries" && self.in_player_researchables {
            self.in_player_researchables = false;
        }

        if name == "research" && self.in_player_completed_research {
            let parent_is_research =
                path.len() >= 2 && path.get(path.len() - 2).map(|s| s.as_str()) == Some("research");
            if !parent_is_research {
                self.in_player_completed_research = false;
            }
        }
    }
}
