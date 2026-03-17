import json

d = json.load(open('src/assets/x4_game_data/8.0-Diplomacy/data/regions.json'))

# 查找 splinetube 类型的 region
for item in d:
    boundary = item.get('boundary', {})
    if boundary.get('class') == 'splinetube':
        print(f"Splinetube region: {item.get('id')}")
        print(f"  boundary: {boundary}")
        print(f"  linear: {item.get('linear')}")
        break
else:
    print("没有找到 splinetube 类型的 region")
