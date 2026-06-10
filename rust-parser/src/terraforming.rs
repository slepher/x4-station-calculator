use crate::model::{
    SaveTerraformingCluster, SaveTerraformingCompletedProject, SaveTerraformingEventProgress,
    SaveTerraformingProjectProgress, SaveTerraformingRebateAmount, WareAmount,
};
use std::collections::{HashMap, VecDeque};

#[derive(Clone, Default)]
pub(crate) struct TerraformingParser {
    clusters: HashMap<String, SaveTerraformingCluster>,
    current: Option<TerraformingState>,
}

#[derive(Clone, Default)]
struct TerraformingState {
    cluster_id: String,
    part: String,
    seed: String,
    active: Option<String>,
    aborted: bool,
    mission_cue: Option<String>,
    mission_complete: bool,
    stats: HashMap<String, f64>,
    rebates: Vec<SaveTerraformingRebateAmount>,
    events: Vec<SaveTerraformingEventProgress>,
    completed_projects: Vec<SaveTerraformingCompletedProject>,
    retained_projects: Vec<SaveTerraformingProjectProgress>,
    active_project: Option<SaveTerraformingProjectProgress>,
    project_depth: usize,
    project: Option<TerraformingProjectState>,
}

#[derive(Clone, Default)]
struct TerraformingProjectState {
    project_id: String,
    completed: Option<i64>,
    start_time: Option<f64>,
    scaled_resources: HashMap<String, i64>,
    delivered_resources: HashMap<String, i64>,
    in_transit_resources: HashMap<String, i64>,
    in_ship: bool,
    ship_cargo: HashMap<String, i64>,
    ship_count: i64,
}

impl TerraformingParser {
    pub(crate) fn clusters(&self) -> &HashMap<String, SaveTerraformingCluster> {
        &self.clusters
    }

    pub(crate) fn open(
        &mut self,
        name: &str,
        attrs: &HashMap<String, String>,
        path: &VecDeque<String>,
        cluster_id: Option<String>,
    ) {
        if name == "terraforming" {
            if let Some(cluster_id) = cluster_id {
                self.current = Some(TerraformingState {
                    cluster_id,
                    part: attrs.get("part").cloned().unwrap_or_default(),
                    seed: attrs.get("seed").cloned().unwrap_or_default(),
                    active: attrs.get("active").cloned().filter(|v| !v.is_empty()),
                    aborted: attrs.get("aborted").map(|v| v == "1").unwrap_or(false),
                    mission_cue: attrs.get("missioncue").cloned(),
                    mission_complete: attrs
                        .get("missioncomplete")
                        .map(|v| v == "1")
                        .unwrap_or(false),
                    ..TerraformingState::default()
                });
            }
            return;
        }

        let Some(state) = self.current.as_mut() else {
            return;
        };

        if name == "stat" {
            if let (Some(id), Some(value)) = (attrs.get("id").cloned(), attrs.get("value").cloned())
            {
                if let Ok(v) = value.parse::<f64>() {
                    state.stats.insert(id, v);
                }
            }
        }

        if name == "project" {
            state.project_depth += 1;
            if state.project_depth == 1 {
                state.project = Some(TerraformingProjectState {
                    project_id: attrs.get("id").cloned().unwrap_or_default(),
                    completed: attrs
                        .get("completed")
                        .cloned()
                        .and_then(|v| v.parse::<i64>().ok()),
                    start_time: attrs
                        .get("starttime")
                        .cloned()
                        .and_then(|v| v.parse::<f64>().ok()),
                    ..TerraformingProjectState::default()
                });
            }
        }

        if name == "ware" && state.project_depth == 1 {
            if let Some(project) = state.project.as_mut() {
                if let (Some(ware), Some(amount_str)) =
                    (attrs.get("ware").cloned(), attrs.get("amount").cloned())
                {
                    if let Ok(amount) = amount_str.parse::<i64>() {
                        let parent = if path.len() >= 2 {
                            path.get(path.len() - 2).map(|s| s.as_str())
                        } else {
                            None
                        };
                        if parent == Some("scaledresources") {
                            *project.scaled_resources.entry(ware).or_insert(0) += amount;
                        } else if parent == Some("deliveredresources") {
                            *project.delivered_resources.entry(ware).or_insert(0) += amount;
                        } else if project.in_ship {
                            *project.ship_cargo.entry(ware).or_insert(0) += amount;
                        }
                    }
                }
            }
        }

        if name == "ship" && state.project_depth == 1 {
            let parent = if path.len() >= 2 {
                path.get(path.len() - 2).map(|s| s.as_str())
            } else {
                None
            };
            if parent == Some("ships") {
                if let Some(project) = state.project.as_mut() {
                    project.in_ship = true;
                    project.ship_cargo = HashMap::new();
                }
            }
        }

        if name == "event" {
            if let Some(completed_str) = attrs.get("completed").cloned() {
                if let Ok(completed_count) = completed_str.parse::<i64>() {
                    state.events.push(SaveTerraformingEventProgress {
                        event_id: attrs.get("id").cloned().unwrap_or_default(),
                        completed_count,
                        start_time: attrs
                            .get("starttime")
                            .cloned()
                            .and_then(|v| v.parse::<f64>().ok()),
                    });
                }
            }
        }

        if name == "rebate" {
            // Only capture runtime rebates directly under <terraforming>,
            // not project-definition rebates inside <project>.
            if state.project_depth == 0 {
                let amount = attrs
                    .get("value")
                    .cloned()
                    .and_then(|v| v.parse::<i64>().ok())
                    .unwrap_or(0);
                if amount != 0 {
                    state.rebates.push(SaveTerraformingRebateAmount {
                        ware: attrs.get("ware").cloned(),
                        ware_group: attrs.get("waregroup").cloned(),
                        amount,
                    });
                }
            }
        }
    }

    pub(crate) fn close(&mut self, name: &str) {
        let Some(state) = self.current.as_mut() else {
            return;
        };

        if name == "ship" && state.project_depth == 1 {
            if let Some(project) = state.project.as_mut() {
                if project.in_ship {
                    project.ship_count += 1;
                    for (ware, amount) in &project.ship_cargo {
                        *project
                            .in_transit_resources
                            .entry(ware.clone())
                            .or_insert(0) += amount;
                    }
                    project.in_ship = false;
                    project.ship_cargo = HashMap::new();
                }
            }
        }

        if name == "project" {
            if state.project_depth > 0 {
                state.project_depth -= 1;
            }
            if state.project_depth == 0 {
                if let Some(project) = state.project.take() {
                    state.finish_project(project);
                }
            }
        }

        if name == "terraforming" {
            let state = self.current.take().unwrap();
            self.clusters
                .insert(state.cluster_id.clone(), state.into_cluster());
        }
    }
}

impl TerraformingState {
    fn finish_project(&mut self, project: TerraformingProjectState) {
        if project.project_id.is_empty() {
            return;
        }

        let scaled_resources = ware_amounts(&project.scaled_resources);
        let submitted_resources = ware_amounts(&project.delivered_resources);
        let in_transit_resources = ware_amounts(&project.in_transit_resources);
        let has_progress = !submitted_resources.is_empty() || !in_transit_resources.is_empty();
        let is_active = self.active.as_ref() == Some(&project.project_id);

        if let Some(completed_count) = project.completed {
            self.completed_projects
                .push(SaveTerraformingCompletedProject {
                    project_id: project.project_id.clone(),
                    completed_count,
                    start_time: project.start_time,
                });
        }

        let progress = SaveTerraformingProjectProgress {
            project_id: project.project_id.clone(),
            aborted: if is_active && self.aborted {
                Some(true)
            } else {
                None
            },
            scaled_resources,
            submitted_resources,
            in_transit_resources: if project.ship_count > 0 {
                Some(in_transit_resources)
            } else {
                None
            },
            in_transit_ship_batches: if project.ship_count > 0 {
                Some(project.ship_count)
            } else {
                None
            },
        };

        if is_active {
            self.active_project = Some(progress);
        } else if has_progress {
            self.retained_projects.push(progress);
        }
    }

    fn into_cluster(self) -> SaveTerraformingCluster {
        SaveTerraformingCluster {
            cluster_id: self.cluster_id,
            part: self.part,
            seed: self.seed,
            mission_cue: self.mission_cue,
            mission_complete: self.mission_complete,
            stats: self.stats,
            rebates: self.rebates,
            active_project: self.active_project,
            completed_projects: self.completed_projects,
            retained_projects: self.retained_projects,
            events: self.events,
        }
    }
}

fn ware_amounts(input: &HashMap<String, i64>) -> Vec<WareAmount> {
    let mut wares = input
        .iter()
        .map(|(ware, amount)| WareAmount {
            ware: ware.clone(),
            amount: *amount,
        })
        .collect::<Vec<_>>();
    wares.sort_by(|a, b| a.ware.cmp(&b.ware));
    wares
}
