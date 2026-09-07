# 修复拖放夹具的数组归属

## Why
DragTestPage向Sortable传可变:list，实际为store的filtered computed缓存；库先改缓存，之后业务moveItem把新增源项当重复，数据与DOM失配。

## What Changes
由store维持领域归属，使用当前vuedraggable已支持的不直接修改该缓存的输入模式。核实locked hover是否由同一根因或真实落点造成，分别保留证据。

## Impact
仅App已存在的drag-test夹具页及专属store/Unit。正式LogicFlow和共享drag helper不改。
