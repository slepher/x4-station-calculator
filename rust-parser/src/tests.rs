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
    fn archives_player_ship_facts_assignments_and_orders() {
        use crate::model::{PlayerShipAssignmentState, PlayerShipCommanderKind};

        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="sector" macro="sec_alpha" knownto="player">
          <component class="station" macro="station_macro" owner="player" code="STATION" id="[station-id]"><subordinates><group index="2" assignmment="trade"/></subordinates><connections><connection connection="subordinates" id="[station-subordinates]"/></connections></component>
          <component class="ship_m" macro="commander_macro" owner="player" code="COMMANDER" id="[ship-commander]"><subordinates><group index="4" assignment="defence"/></subordinates><connections><connection connection="subordinates" id="[ship-subordinates]"/></connections></component>
          <component class="ship_l" macro="transport_macro" owner="player" name="Transport One" code="TRADER" id="[station-child]"><offset><position x="1000" y="2000" z="3000"/></offset><subordinate group="2"/><orders loop="1"><order id="[default]" default="1" order="Wait" state="started"/><order id="[dock]" order="DockAndWait" state="started"><param name="destination" type="component" value="[station-id]"/></order><order id="[fly]" order="FlyAndWait"/><order id="[trade]" order="TradePerform" failed="1"/></orders><connections><connection connection="commander" id="[station-child-commander]"><connected connection="[station-subordinates]"/></connection></connections></component>
          <component class="ship_s" macro="fighter_macro" owner="player" code="WING" id="[ship-child]"><subordinate group="4"/><connections><connection connection="commander" id="[ship-child-commander]"><connected connection="[ship-subordinates]"/></connection></connections></component>
          <component class="ship_s" macro="idle_macro" owner="player" code="IDLE" id="[unassigned]"><orders><order id="[wait]" default="1" order="Wait" state="started"/></orders></component>
          <component class="ship_s" macro="broken_macro" owner="player" code="BROKEN" id="[broken]"><subordinate group="1"/><connections><connection connection="commander" id="[broken-commander]"><connected connection="[missing-subordinates]"/></connection></connections></component>
          <component class="ship_s" macro="incomplete_macro" owner="player" code="INCOMPLETE" id="[incomplete]"><subordinate group="1"/></component>
          <component class="ship_l" macro="npc_macro" owner="argon" code="NPC" id="[npc]"/>
        </component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(4096) {}

        let archive = parser.finish_archive("ships.xml").expect("archive");
        let ships = &archive.sectors["sec_alpha"].player_ships;
        let trader = &ships["station-child"];

        assert_eq!(archive.meta.parser_version, "v15");
        assert_eq!(ships.len(), 6);
        assert!(!ships.contains_key("npc"));
        assert_eq!(trader.name.as_deref(), Some("Transport One"));
        assert_eq!(trader.class, "ship_l");
        assert_eq!(
            (
                trader.relative_position.x,
                trader.relative_position.y,
                trader.relative_position.z,
            ),
            (1000.0, 2000.0, 3000.0)
        );
        assert_eq!(trader.assignment.state, PlayerShipAssignmentState::Resolved);
        assert_eq!(
            trader.assignment.commander_kind,
            Some(PlayerShipCommanderKind::Station)
        );
        assert_eq!(
            trader.assignment.commander_id.as_deref(),
            Some("station-id")
        );
        assert_eq!(trader.assignment.role.as_deref(), Some("trade"));
        assert_eq!(
            trader
                .default_order
                .as_ref()
                .map(|order| order.order.as_str()),
            Some("Wait")
        );
        assert_eq!(trader.orders.len(), 3);
        assert_eq!(trader.orders[0].order, "DockAndWait");
        assert_eq!(trader.orders[0].targets[0].value, "station-id");
        assert_eq!(trader.orders[1].order, "FlyAndWait");
        assert_eq!(trader.orders[2].order, "TradePerform");
        assert!(trader.orders[2].failed);
        assert!(trader.is_repeat);

        let fleet_ship = &ships["ship-child"];
        assert_eq!(
            fleet_ship.assignment.commander_kind,
            Some(PlayerShipCommanderKind::Ship)
        );
        assert_eq!(fleet_ship.assignment.role.as_deref(), Some("defence"));
        assert_eq!(
            ships["unassigned"].assignment.state,
            PlayerShipAssignmentState::None
        );
        assert_eq!(
            ships["broken"].assignment.state,
            PlayerShipAssignmentState::Unresolved
        );
        assert_eq!(
            ships["incomplete"].assignment.state,
            PlayerShipAssignmentState::Unresolved
        );

        let json = serde_json::to_value(&archive).expect("serialize archive");
        assert_eq!(
            json["sectors"]["sec_alpha"]["player_ships"]["station-child"]["default_order"]["order"],
            "Wait"
        );
    }

    #[test]
    fn imports_real_save_player_ship_cargo() {
        let xml = include_str!("../../tests/fixtures/save/save_009_player_ship_cargo.xml");
        let mut parser = StreamingSaveParser::new(None);
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(4096) {}

        let archive = parser.finish_archive("save_009.xml").expect("archive");
        let ship = &archive.sectors["cluster_37_sector001_macro"].player_ships["0xeb6b"];

        assert_eq!(ship.code, "LNB-505");
        assert_eq!(ship.macro_field, "ship_par_l_trans_container_03_a_macro");
        assert_eq!(ship.cargo.len(), 1);
        assert_eq!(ship.cargo[0].ware, "missilecomponents");
        assert_eq!(ship.cargo[0].amount, 281);
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
    fn player_relation_booster_overrides_base_relation_when_present() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><faction id="player"><relations><relation faction="antigone" relation="-0.032"/><relation faction="ministry" relation="-0.032"/><booster faction="antigone" relation="0.800418"/></relations></faction></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(4096) {}

        let archive = parser.finish_archive("relations.xml").expect("archive");

        assert_eq!(archive.player_relations.get("antigone"), Some(&0.800418));
        assert_eq!(archive.player_relations.get("ministry"), Some(&-0.032));
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
    fn imports_real_save_npc_trade_offer_shapes() {
        let xml = include_str!("../../tests/fixtures/save/save_009_npc_trade_offers.xml");

        let mut parser = StreamingSaveParser::new(None);
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(4096) {}

        let archive = parser.finish_archive("save_009.xml").expect("archive");
        let offers =
            &archive.sectors["cluster_409_sector001_macro"].npc_stations["ZQE-568"].trade_offers;

        assert_eq!(offers.len(), 11);
        let sell = offers
            .iter()
            .find(|offer| offer.trade_id == "0x546c")
            .unwrap();
        assert_eq!(sell.side, "sell");
        assert_eq!(sell.amount, 9053);
        assert_eq!(sell.desired, None);
        assert!(!offers.iter().any(|offer| offer.trade_id == "0x546b"));
        let complete_buy = offers
            .iter()
            .find(|offer| offer.trade_id == "0x546d")
            .unwrap();
        assert_eq!(complete_buy.amount, 1606);
        assert_eq!(complete_buy.desired, Some(1606));

        let zero_sell_offers =
            &archive.sectors["cluster_43_sector001_macro"].npc_stations["GSP-924"].trade_offers;
        assert_eq!(zero_sell_offers.len(), 4);
        assert!(zero_sell_offers.iter().all(|offer| offer.side == "buy"));

        let supplies_xml = include_str!("../../tests/fixtures/save/save_009_npc_buy_supplies.xml");
        let mut supplies_parser = StreamingSaveParser::new(None);
        supplies_parser.push_chunk(supplies_xml.as_bytes());
        supplies_parser.finish_input();
        while supplies_parser.pump(4096) {}
        let supplies_archive = supplies_parser
            .finish_archive("save_009.xml")
            .expect("archive");
        assert!(
            supplies_archive.sectors["cluster_409_sector001_macro"].npc_stations["EST-150"]
                .trade_offers
                .is_empty()
        );
    }

    #[test]
    fn links_unique_npc_buildstorage() {
        let xml = r#"<savegame><component class="sector" macro="sec_alpha"><component class="buildstorage" owner="argon" code="BUILD-1" spawntime="42" id="[0xbuild]"/><component class="station" owner="argon" code="NPC-1" spawntime="42" id="[0xstation]"><listeners><listener listener="[0xbuild]"/></listeners></component></component></savegame>"#;
        let mut parser = StreamingSaveParser::new(None);
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(4096) {}

        let archive = parser.finish_archive("link.xml").expect("archive");
        let buildstorage = archive.sectors["sec_alpha"].npc_stations["NPC-1"]
            .build_storage
            .as_ref()
            .expect("buildstorage");
        assert_eq!(buildstorage.component_id, "0xbuild");
        assert_eq!(buildstorage.code, "BUILD-1");
    }

    #[test]
    fn leaves_ambiguous_npc_buildstorage_unlinked() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="sector" macro="sec_alpha"><component class="buildstorage" code="BUILD-1" owner="argon" spawntime="42" id="[0xb1]"/><component class="buildstorage" code="BUILD-2" owner="argon" spawntime="42" id="[0xb2]"/><component class="buildstorage" code="SHARED" owner="argon" spawntime="43" id="[0xshared]"/><component class="station" code="MULTI" owner="argon" spawntime="42" id="[0xs1]"><listeners><listener listener="[0xb1]"/><listener listener="[0xb2]"/></listeners></component><component class="station" code="SHARED-1" owner="argon" spawntime="43" id="[0xs2]"><listeners><listener listener="[0xshared]"/></listeners></component><component class="station" code="SHARED-2" owner="argon" spawntime="43" id="[0xs3]"><listeners><listener listener="[0xshared]"/></listeners></component></component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(4096) {}

        let archive = parser.finish_archive("ambiguous.xml").expect("archive");
        let stations = &archive.sectors["sec_alpha"].npc_stations;
        assert!(stations["MULTI"].build_storage.is_none());
        assert!(stations["SHARED-1"].build_storage.is_none());
        assert!(stations["SHARED-2"].build_storage.is_none());
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
        assert!(
            json.contains("\"activeId\":null"),
            "expected activeId:null, got: {}",
            json
        );
    }

    #[test]
    fn research_runtime_serializes_with_active_id() {
        let r = crate::model::SaveResearchRuntime {
            visible_ids: vec!["research_a".into()],
            completed_ids: vec!["research_b".into()],
            active_id: Some("research_c".into()),
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(
            json.contains("\"visibleIds\":[\"research_a\"]"),
            "got: {}",
            json
        );
        assert!(
            json.contains("\"completedIds\":[\"research_b\"]"),
            "got: {}",
            json
        );
        assert!(
            json.contains("\"activeId\":\"research_c\""),
            "got: {}",
            json
        );
    }

    #[test]
    fn parses_research_runtime_from_player_and_hq_production_components() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="player" macro="player_macro"><entries type="researchables"><entry id="research_a"/><entry id="not_research"/></entries><research><research ware="research_done" method="research"/><research ware="research_trade" method="trade"/></research></component><component class="production" macro="landmarks_player_hq_01_research_macro"><production state="waitingforresources"><queue ware="research_warp_hq_02" method="research"><insufficient><ware ware="fieldcoils" amount="1"/></insufficient></queue></production></component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(4096) {}

        let archive = parser.finish_archive("research.xml").expect("archive");

        assert_eq!(archive.research.visible_ids, vec!["research_a"]);
        assert_eq!(archive.research.completed_ids, vec!["research_done"]);
        assert_eq!(
            archive.research.active_id.as_deref(),
            Some("research_warp_hq_02")
        );
    }

    #[test]
    fn parses_terraforming_ship_count_and_in_transit_resources() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="cluster" macro="cluster_26_macro"><terraforming part="planet001b" seed="seed" active="agr_hydroponics" missioncomplete="0"><stats><stat id="temperature" value="9"/></stats><projects><project id="agr_hydroponics" starttime="123"><scaledresources><ware ware="energycells" amount="100"/></scaledresources><deliveredresources><ware ware="energycells" amount="40"/></deliveredresources><ships><ship id="[0x1]"><cargo><ware ware="energycells" amount="10"/><ware ware="hullparts" amount="3"/></cargo></ship><ship id="[0x2]"><cargo><ware ware="energycells" amount="2"/></cargo></ship></ships><predecessors><projects><project id="nested_reference"/></projects></predecessors></project></projects><events><event id="evt_done" completed="2" starttime="456"/><event id="evt_pending"/></events><rebates><rebate ware="energycells" value="5"/></rebates></terraforming></component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(4096) {}

        let archive = parser.finish_archive("terraforming.xml").expect("archive");
        let cluster = archive
            .terraforming_clusters
            .get("cluster_26_macro")
            .expect("terraforming cluster");
        let active = cluster.active_project.as_ref().expect("active project");

        assert_eq!(cluster.cluster_id, "cluster_26_macro");
        assert_eq!(cluster.stats["temperature"], 9.0);
        assert_eq!(active.project_id, "agr_hydroponics");
        assert_eq!(active.in_transit_ship_batches, Some(2));
        let in_transit_resources = active
            .in_transit_resources
            .as_ref()
            .expect("in-transit resources");
        assert_eq!(in_transit_resources.len(), 2);
        assert_eq!(in_transit_resources[0].ware, "energycells");
        assert_eq!(in_transit_resources[0].amount, 12);
        assert_eq!(in_transit_resources[1].ware, "hullparts");
        assert_eq!(in_transit_resources[1].amount, 3);
        assert!(cluster.completed_projects.is_empty());
        assert_eq!(cluster.events.len(), 1);
        assert_eq!(cluster.events[0].completed_count, 2);
        assert_eq!(cluster.rebates[0].amount, 5);
    }

    #[test]
    fn omits_in_transit_fields_when_project_has_no_ships() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><component class="cluster" macro="cluster_no_ships"><terraforming part="planet" seed="seed" active="atm_methane_oxidize"><projects><project id="atm_methane_oxidize"><scaledresources><ware ware="energycells" amount="100"/></scaledresources><deliveredresources><ware ware="energycells" amount="40"/></deliveredresources></project></projects></terraforming></component></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(xml.as_bytes());
        parser.finish_input();
        while parser.pump(4096) {}

        let archive = parser
            .finish_archive("terraforming-no-ships.xml")
            .expect("archive");
        let cluster = archive
            .terraforming_clusters
            .get("cluster_no_ships")
            .expect("terraforming cluster");
        let active = cluster.active_project.as_ref().expect("active project");
        let json = serde_json::to_value(active).expect("active project json");

        assert!(active.in_transit_resources.is_none());
        assert_eq!(active.in_transit_ship_batches, None);
        assert!(json.get("inTransitResources").is_none(), "got: {}", json);
        assert!(json.get("inTransitShipBatches").is_none(), "got: {}", json);
    }

    #[test]
    fn stops_after_universe_and_ignores_later_save_sections() {
        let xml = r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><universe><component class="sector" macro="sec_alpha" knownto="player"></component></universe><economylog><entries><log id="ignored"/></entries></economylog></savegame>"#;

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.push_chunk(xml.as_bytes());

        while parser.pump(4096) {}

        let progress = serde_json::from_str::<serde_json::Value>(&parser.progress_json())
            .expect("progress json");
        let archive = parser.finish_archive("universe.xml").expect("archive");

        assert_eq!(archive.sectors.len(), 1);
        assert_eq!(progress["done"], true);
        assert_eq!(progress["phase"], "done");
    }

    #[test]
    fn gzip_stream_can_finish_before_compressed_input_is_exhausted_after_universe() {
        let mut xml = String::from(
            r#"<savegame><info><game guid="g" seed="1" time="2" version="8.0"/><player name="p"/></info><universe><component class="sector" macro="sec_alpha" knownto="player"></component></universe><economylog><entries>"#,
        );
        for i in 0..20_000 {
            xml.push_str(&format!(r#"<log id="{i}" value="{}"/>"#, i * 17));
        }
        xml.push_str("</entries></economylog></savegame>");

        let mut encoder = GzEncoder::new(Vec::new(), Compression::none());
        encoder.write_all(xml.as_bytes()).expect("write gzip");
        let gzipped = encoder.finish().expect("finish gzip");

        let mut parser = StreamingSaveParser::new(Some("8.0".to_string()));
        parser.set_expected_total_bytes(xml.len());
        let mut consumed = 0usize;
        for chunk in gzipped.chunks(512) {
            consumed += chunk.len();
            parser.push_chunk(chunk);
            while parser.pump(128) {}
            let progress = serde_json::from_str::<serde_json::Value>(&parser.progress_json())
                .expect("progress json");
            if progress["done"] == true {
                break;
            }
        }

        assert!(consumed < gzipped.len(), "gzip stream was fully consumed");
        let archive = parser.finish_archive("early.xml.gz").expect("archive");
        assert_eq!(archive.sectors.len(), 1);
        assert!(archive.sectors.contains_key("sec_alpha"));
    }
}
