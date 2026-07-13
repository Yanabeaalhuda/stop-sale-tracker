import os
import json

# Get the directory of the script
script_dir = os.path.dirname(os.path.abspath(__file__))
data_dir = os.path.join(script_dir, 'data')

if not os.path.exists(data_dir):
    print("Error: 'data' folder does not exist.")
    exit(1)

# Find all .xlsx and .xls files
files = [
    f"data/{f}" for f in os.listdir(data_dir)
    if f.lower().endswith(('.xlsx', '.xls'))
]

# Write to data/manifest.json
manifest_path = os.path.join(data_dir, 'manifest.json')
with open(manifest_path, 'w', encoding='utf-8') as f:
    json.dump(files, f, indent=2)

# Write to data/files.json
files_json_path = os.path.join(data_dir, 'files.json')
with open(files_json_path, 'w', encoding='utf-8') as f:
    json.dump(files, f, indent=2)

print(f"Successfully updated manifests with {len(files)} Excel files:")
for f in files:
    print(f" - {f}")
