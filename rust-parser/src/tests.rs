#[cfg(test)]
mod tests {
    use crate::core::SaveParserCore;
    use crate::stream::StreamingSaveParser;
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use std::io::Write;

    #[test]
    fn parses_uppercase_station_attributes_like_js_parser() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="sector" macro="sec_alpha" knownto="player"><component CLASS="station" MACRO="station_macro" OWNER="player" CODE="AAA" FACTIONHEADQUARTERS="1"><offset><position X="1" Y="2" Z="3"/></offset></component></component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(1024) {}

        let archive = parser.finish_archive("save.xml").expect("archive");
        let sector = archive.sectors.get("sec_alpha").expect("sector");
        let station = sector.player_stations.get("AAA").expect("station");

        assert_eq!(station.base.owner, "player");
        assert_eq!(station.base.code, "AAA");
        assert_eq!(station.base.macro_field, "station_macro");
        assert_eq!(station.base.is_headquarter, Some(true));
        assert_eq!(
            (
                station.base.relative_position.x,
                station.base.relative_position.y,
                station.base.relative_position.z,
            ),
            (1.0, 2.0, 3.0)
        );
    }

    #[test]
    fn no_expected_version_means_compatible() {
        let mut core = SaveParserCore::new(None);
        core.meta.version = "7.0".into();

        let archive = core.finish_archive("legacy.xml").expect("archive");

        assert!(archive.is_compatible);
    }

    #[test]
    fn parses_across_small_chunks() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="sector" macro="sec_alpha" knownto="player"><component class="station" macro="station_macro" owner="player" code="AAA"><offset><position x="4" y="5" z="6"/></offset><construction><sequence><entry index="1" macro="mod_macro"><upgrades><groups><shields macro="shield_macro" group="g1" exact="2"/></groups></upgrades></entry></sequence></construction></component></component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        for chunk in xml.as_bytes().chunks(7) {
            parser.push_chunk(chunk);
            let _ = parser.pump(8);
        }
        parser.finish_input();
        while parser.pump(8) {}

        let archive = parser.finish_archive("chunked.xml").expect("archive");
        let station = archive.sectors["sec_alpha"]
            .player_stations
            .get("AAA")
            .expect("station");
        let construction = &station.constructions[0];

        assert_eq!(
            (
                station.base.relative_position.x,
                station.base.relative_position.y,
                station.base.relative_position.z,
            ),
            (4.0, 5.0, 6.0)
        );
        assert_eq!(construction.index, 1);
        assert_eq!(construction.ref_field, "mod_macro");
        assert_eq!(construction.equipments[0].ref_field, "shield_macro");
        assert_eq!(construction.equipments[0].exact, 2);
    }

    #[test]
    fn progress_percent_uses_expected_total_bytes_when_available() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="sector" macro="sec_alpha" known="1"></component></savegame>"#;
        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.set_expected_total_bytes(xml.len() * 2);
        parser.push_chunk(xml.as_bytes());
        let _ = parser.pump(4096);

        let progress: serde_json::Value =
            serde_json::from_str(&parser.progress_json()).expect("progress json");

        let percent = progress["percent"].as_f64().expect("percent");
        assert!(percent > 40.0 && percent < 60.0, "percent was {percent}");
    }

    #[test]
    fn pump_stops_when_waiting_for_more_stream_input() {
        let partial = b"<savegame><info><game";
        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(partial);

        let has_more = parser.pump(4096);

        assert!(!has_more);
    }

    #[test]
    fn cli_progress_is_emitted_only_when_rust_progress_bucket_changes() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="sector" macro="sec_alpha" knownto="player"><component class="station" macro="station_macro" owner="player" code="AAA"><offset><position x="1" y="2" z="3"/></offset></component></component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.set_expected_total_bytes(xml.len() * 100);
        parser.push_chunk(xml.as_bytes());

        let initial = parser.take_cli_progress_json();
        assert!(!initial.is_empty());

        let _ = parser.pump(1);
        let progress_a = parser.take_cli_progress_json();

        let _ = parser.pump(1);
        let progress_b = parser.take_cli_progress_json();

        assert!(progress_a.is_empty() || progress_b.is_empty());

        parser.finish_input();
        while parser.pump(4096) {}

        let final_progress = parser.take_cli_progress_json();
        assert!(!final_progress.is_empty());
        assert!(final_progress.contains(r#""done":true"#));
    }

    #[test]
    fn parses_gzip_input_stream_inside_rust_parser() {
        let xml = r#"<savegame><info><game guid="GUID-3" seed="7" time="8" version="8.0"/><player name="gzip"/></info><component class="sector" macro="gzip_sector" known="1"><component class="station" macro="gzip_station" code="GZIP-1" owner="player"><offset><position x="11" y="22" z="33"/></offset></component></component></savegame>"#;
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(xml.as_bytes()).expect("write gzip");
        let gzipped = encoder.finish().expect("finish gzip");

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.set_expected_total_bytes(xml.len());
        for chunk in gzipped.chunks(9) {
            parser.push_chunk(chunk);
            let _ = parser.pump(64);
        }
        parser.finish_input();
        while parser.pump(1024) {}

        let archive = parser.finish_archive("gzip.xml.gz").expect("archive");
        let station = archive.sectors["gzip_sector"]
            .player_stations
            .get("GZIP-1")
            .expect("station");

        assert_eq!(archive.meta.player_name, "gzip");
        assert_eq!(station.base.code, "GZIP-1");
        assert_eq!(
            (
                station.base.relative_position.x,
                station.base.relative_position.y,
                station.base.relative_position.z,
            ),
            (11.0, 22.0, 33.0)
        );
    }

    #[test]
    fn aggregates_modules_for_xenon_and_khaak_stations() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="sector" macro="sec_alpha" knownto="player"><component class="station" macro="xen_station" owner="xenon" code="XEN-1"><construction><sequence><entry index="1" macro="buildmodule_xen_ships_xl_macro"/><entry index="2" macro="buildmodule_xen_ships_xl_macro"/></sequence></construction></component><component class="station" macro="kha_station" owner="khaak" code="KHA-1"><construction><sequence><entry index="1" macro="module_khaak_special"/><entry index="2" macro="module_khaak_special"/></sequence></construction></component></component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(4096) {}

        let archive = parser.finish_archive("factions.xml").expect("archive");
        let sector = archive.sectors.get("sec_alpha").expect("sector");

        let xen_mod = sector.xenon_stations["XEN-1"]
            .modules
            .iter()
            .find(|m| m.ref_field == "buildmodule_xen_ships_xl_macro")
            .expect("xen module");
        assert_eq!(xen_mod.ref_field, "buildmodule_xen_ships_xl_macro");
        assert_eq!(xen_mod.amount, 2);

        let kha_mod = sector.khaak_stations["KHA-1"]
            .modules
            .iter()
            .find(|m| m.ref_field == "module_khaak_special")
            .expect("kha module");
        assert_eq!(kha_mod.ref_field, "module_khaak_special");
        assert_eq!(kha_mod.amount, 2);
    }

    #[test]
    fn extracts_predecessor_from_player_station_construction() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="sector" macro="sec_alpha" knownto="player"><component class="station" macro="station_macro" owner="player" code="AAA"><construction><sequence><entry index="1" macro="dock_macro"/><entry index="2" macro="storage_macro"><predecessor index="1" connection="connectionsnap001"/></entry></sequence></construction></component></component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(4096) {}

        let archive = parser.finish_archive("predecessor.xml").expect("archive");
        let station = archive.sectors["sec_alpha"]
            .player_stations
            .get("AAA")
            .expect("station");

        assert_eq!(station.constructions.len(), 2);
        assert_eq!(station.constructions[0].index, 1);
        assert_eq!(station.constructions[0].ref_field, "dock_macro");
        assert_eq!(station.constructions[0].predecessor, None);
        assert_eq!(station.constructions[1].index, 2);
        assert_eq!(station.constructions[1].ref_field, "storage_macro");
        assert_eq!(station.constructions[1].predecessor, Some(1));
    }

    #[test]
    fn assigns_nested_buildstorage_storage_cargo_and_reservations_to_buildstorage() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="sector" macro="sec_alpha" knownto="player"><component class="station" macro="station_macro" owner="player" code="AAA" id="[0xstation]"></component><component class="buildstorage" macro="buildstorage_macro" owner="player" code="FIX-154" id="[0xbuildstorage]"><buildtasks><inprogress><build component="[0xstation]"/></inprogress></buildtasks><connections><connection connection="con_storage01"><component class="storage" macro="storage_gen_buildstorage_01_macro" id="[0xstorage]"><cargo><ware ware="energycells" amount="10"/><ware ware="hullparts" amount="20"/></cargo><trade><reservations><reservation ware="hullparts" amount="5"/></reservations></trade></component></connection></connections></component></component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(4096) {}

        let archive = parser.finish_archive("buildstorage.xml").expect("archive");
        let sector = archive.sectors.get("sec_alpha").expect("sector");
        let buildstorage = sector
            .player_buildstorages
            .get("FIX-154")
            .expect("buildstorage");

        assert_eq!(
            buildstorage.target_station_component_id.as_deref(),
            Some("0xstation")
        );
        assert_eq!(buildstorage.cargo.len(), 2);
        assert_eq!(buildstorage.cargo[0].ware, "energycells");
        assert_eq!(buildstorage.cargo[0].amount, 10);
        assert_eq!(buildstorage.cargo[1].ware, "hullparts");
        assert_eq!(buildstorage.cargo[1].amount, 20);
        assert_eq!(buildstorage.reservation.len(), 1);
        assert_eq!(buildstorage.reservation[0].ware, "hullparts");
        assert_eq!(buildstorage.reservation[0].amount, 5);
    }

    #[test]
    fn aggregates_equipments_for_npc_stations() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="sector" macro="sec_alpha" knownto="player"><component class="station" macro="npc_station" owner="argony" code="NPC-1"><construction><sequence><entry index="1" macro="module_dock"><upgrades><groups><shields macro="shield_macro" group="g1" exact="3"/><turrets macro="turret_macro" group="g2" exact="5"/></groups></upgrades></entry><entry index="2" macro="module_dock"><upgrades><groups><shields macro="shield_macro" group="g1" exact="2"/></groups></upgrades></entry></sequence></construction></component></component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(4096) {}

        let archive = parser.finish_archive("npc_equip.xml").expect("archive");
        let station = archive.sectors["sec_alpha"]
            .npc_stations
            .get("NPC-1")
            .expect("station");

        assert_eq!(station.modules.len(), 1);
        let dock_mod = station
            .modules
            .iter()
            .find(|m| m.ref_field == "module_dock");
        assert_eq!(dock_mod.map(|m| m.ref_field.as_str()), Some("module_dock"));
        assert_eq!(dock_mod.map(|m| m.amount), Some(2));

        assert_eq!(station.equipments.len(), 2);
        let shield_equip = station
            .equipments
            .iter()
            .find(|e| e.ref_field == "shield_macro");
        assert_eq!(shield_equip.map(|e| e.equip_type.as_str()), Some("shields"));
        assert_eq!(
            shield_equip.map(|e| e.ref_field.as_str()),
            Some("shield_macro")
        );
        assert_eq!(shield_equip.map(|e| e.amount), Some(5));

        let turret_equip = station
            .equipments
            .iter()
            .find(|e| e.ref_field == "turret_macro");
        assert_eq!(turret_equip.map(|e| e.equip_type.as_str()), Some("turrets"));
        assert_eq!(
            turret_equip.map(|e| e.ref_field.as_str()),
            Some("turret_macro")
        );
        assert_eq!(turret_equip.map(|e| e.amount), Some(5));
    }

    #[test]
    fn extracts_station_cargo_reservation_and_buildstorage_fields() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="sector" macro="sec_alpha" knownto="player"><component class="station" macro="station_macro" owner="player" code="AAA" id="[0xstation]"><connections><connection connection="modules"><component class="storage" macro="storage_macro" id="[0xstorage]"><cargo><ware ware="energycells" amount="12"/><ware ware="energycells" amount="8"/><ware ware="hullparts" amount="5"/></cargo></component></connection></connections><trade><reservations><reservation ware="energycells" amount="4"/><reservation ware="claytronics" amount="2"/></reservations></trade><construction><sequence><entry id="[0xentry1]" index="1" macro="dock_macro"><upgrades><groups><shields macro="shield_macro" group="g1" exact="2"/></groups></upgrades></entry></sequence></construction></component><component class="buildstorage" macro="buildstorage_macro" owner="player" code="FIX-1" id="[0xbuilder]"><trade><reservations><reservation ware="hullparts" amount="7"/></reservations></trade><cargo><ware ware="hullparts" amount="9"/></cargo><buildtasks><inprogress><build id="[0xbuild]" builder="[0xbuilder]" component="[0xstation]"><sequence><entry id="[0xentry1]" index="1" macro="dock_macro"><upgrades><groups><turrets macro="turret_macro" group="g2" exact="3"/></groups></upgrades></entry></sequence></build></inprogress></buildtasks><connections><connection connection="con_buildmodule01"><component class="buildmodule" macro="buildmodule_macro" id="[0xbuildmodule]"><connections><connection connection="buildprocessorconnection_01"><component class="buildprocessor" macro="buildprocessor_macro" id="[0xprocessor]"><build start="10" end="20" sequenceindex="1"/></component></connection></connections></component></connection></connections></component></component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(4096) {}

        let archive = parser.finish_archive("buildstorage.xml").expect("archive");
        let sector = archive.sectors.get("sec_alpha").expect("sector");
        let station = sector.player_stations.get("AAA").expect("station");
        let buildstorage = sector
            .player_buildstorages
            .get("FIX-1")
            .expect("buildstorage");

        assert_eq!(station.component_id.as_deref(), Some("0xstation"));
        assert_eq!(station.constructions[0].id.as_deref(), Some("0xentry1"));
        assert_eq!(
            station.constructions[0].equipments[0].ref_field,
            "shield_macro"
        );
        assert_eq!(station.cargo.len(), 2);
        assert_eq!(station.cargo[0].ware, "energycells");
        assert_eq!(station.cargo[0].amount, 20);
        assert_eq!(station.reservation.len(), 2);
        assert_eq!(buildstorage.component_id, "0xbuilder");
        assert_eq!(
            buildstorage.target_station_component_id.as_deref(),
            Some("0xstation")
        );
        assert_eq!(buildstorage.cargo[0].ware, "hullparts");
        assert_eq!(buildstorage.cargo[0].amount, 9);
        assert_eq!(buildstorage.reservation[0].ware, "hullparts");
        assert_eq!(buildstorage.reservation[0].amount, 7);
        assert_eq!(
            buildstorage.constructions[0].id.as_deref(),
            Some("0xentry1")
        );
        assert_eq!(
            buildstorage.constructions[0].equipments[0].ref_field,
            "turret_macro"
        );
        assert_eq!(buildstorage.station_code, None);
        assert_eq!(
            buildstorage.progress.as_ref().and_then(|v| v.start),
            Some(10.0)
        );
        assert_eq!(
            buildstorage.progress.as_ref().and_then(|v| v.end),
            Some(20.0)
        );
        assert_eq!(
            buildstorage.progress.as_ref().and_then(|v| v.sequenceindex),
            Some(1)
        );
    }

    #[test]
    fn parses_player_station_trade_overrides() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="sector" macro="sec_alpha" knownto="player"><component class="station" macro="station_macro" owner="player" code="AAA"><trade><offers /></trade><overrides><max><ware ware="energycells" amount="800000"/><ware ware="ore" amount="60000"/></max><buy><ware ware="energycells" amount="200000"/><ware ware="microchips" amount="3000"/></buy><sell><ware ware="energycells" amount="400000"/><ware ware="quantumtubes" amount="3000"/></sell></overrides></component></component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(4096) {}

        let archive = parser.finish_archive("overrides.xml").expect("archive");
        let station = archive.sectors["sec_alpha"]
            .player_stations
            .get("AAA")
            .expect("station");

        let overrides = station.overrides.as_ref().expect("overrides");
        assert_eq!(overrides.max.len(), 2);
        assert_eq!(overrides.max[0].ware, "energycells");
        assert_eq!(overrides.max[0].amount, 800000);
        assert_eq!(overrides.max[1].ware, "ore");
        assert_eq!(overrides.max[1].amount, 60000);

        assert_eq!(overrides.buy.len(), 2);
        assert_eq!(overrides.buy[0].ware, "energycells");
        assert_eq!(overrides.buy[0].amount, 200000);
        assert_eq!(overrides.buy[1].ware, "microchips");
        assert_eq!(overrides.buy[1].amount, 3000);

        assert_eq!(overrides.sell.len(), 2);
        assert_eq!(overrides.sell[0].ware, "energycells");
        assert_eq!(overrides.sell[0].amount, 400000);
        assert_eq!(overrides.sell[1].ware, "quantumtubes");
        assert_eq!(overrides.sell[1].amount, 3000);
    }

    #[test]
    fn research_runtime_serializes_with_null_active_id() {
        let r = crate::model::SaveResearchRuntime::default();
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("\"activeId\":null"), "expected activeId:null, got: {}", json);
    }

    #[test]
    fn research_runtime_serializes_with_active_id() {
        let r = crate::model::SaveResearchRuntime {
            visible_ids: vec!["research_a".into()],
            completed_ids: vec!["research_b".into()],
            active_id: Some("research_c".into()),
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("\"visibleIds\":[\"research_a\"]"), "got: {}", json);
        assert!(json.contains("\"completedIds\":[\"research_b\"]"), "got: {}", json);
        assert!(json.contains("\"activeId\":\"research_c\""), "got: {}", json);
    }
}
