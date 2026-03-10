filepath = r'c:\Users\Ravin\OneDrive\Desktop\Whisperlink\frontend\src\components\ChatRoom.jsx'
with open(filepath, encoding='utf-8') as f:
    lines = f.readlines()
# Keep only first 483 lines (0-indexed: 0..482)
with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(lines[:483])
print(f"Done. File now has {len(lines[:483])} lines.")
