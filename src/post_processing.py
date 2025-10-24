import pandas as pd
import os
import json

# This is the custom formatter, which is correct and remains.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def format_json_with_compact_sparks(all_runners_data: list) -> str:
    """
    Custom JSON formatter for a readable, semi-compact output.
    - Each runner entry is indented.
    - The 'skills' array is an indented, multi-line list.
    - The 'sparks' objects within their arrays are on single lines.
    """
    output_parts = []
    for runner_index, runner_dict in enumerate(all_runners_data):
        lines = []
        lines.append("  {")
        simple_keys = [k for k in runner_dict.keys() if k not in ['sparks', 'skills']]
        for key_index, key in enumerate(simple_keys):
            value = runner_dict[key]
            value_str = json.dumps(value, ensure_ascii=False)
            is_last_simple_key = (key_index == len(simple_keys) - 1)
            comma = ""
            if not is_last_simple_key or 'skills' in runner_dict or 'sparks' in runner_dict:
                comma = ","
            lines.append(f'    "{key}": {value_str}{comma}')
        if 'skills' in runner_dict and runner_dict['skills']:
            lines.append('    "skills": [')
            skill_lines = [f'      {json.dumps(s, ensure_ascii=False)}' for s in runner_dict['skills']]
            lines.append(",\n".join(skill_lines))
            comma = "," if 'sparks' in runner_dict else ""
            lines.append(f'    ]{comma}')
        if 'sparks' in runner_dict:
            lines.append('    "sparks": {')
            sparks_data = runner_dict.get('sparks', {})
            for spark_type_index, (spark_type, spark_list) in enumerate(sparks_data.items()):
                compact_spark_lines = [f"        {json.dumps(s, ensure_ascii=False)}" for s in spark_list]
                spark_block = ",\n".join(compact_spark_lines)
                lines.append(f'      "{spark_type}": [\n{spark_block}\n      ]')
                if spark_type_index < len(sparks_data) - 1:
                    lines[-1] += ","
            lines.append('    }')
        lines.append("  }")
        if runner_index < len(all_runners_data) - 1:
            lines[-1] += ","
        output_parts.append("\n".join(lines))
    return "[\n" + "\n".join(output_parts) + "\n]\n"


def update_all_runners(new_runners_df: pd.DataFrame):
    """
    Reads existing all_runners.json, detects conflicts, writes them to a file,
    and updates the main JSON with ONLY non-conflicting new entries.
    """
    if new_runners_df.empty:
        print("No new runners to update.")
        return

    output_file = os.path.join(BASE_DIR, "data", "all_runners.json")
    conflicts_file = os.path.join(BASE_DIR, 'data', 'conflicts.json')
    
    try:
        with open(output_file, 'r', encoding='utf-8') as f:
            existing_data_list = json.load(f)
        existing_df = pd.DataFrame(existing_data_list)
    except (FileNotFoundError, ValueError):
        existing_df = pd.DataFrame()

    conflicts = []
    hashes_with_conflicts = []

    # --- Conflict Detection Logic ---
    if not existing_df.empty and not new_runners_df.empty:
        existing_indexed = existing_df.set_index('entry_hash')
        new_indexed = new_runners_df.set_index('entry_hash')
        common_hashes = new_indexed.index.intersection(existing_indexed.index)

        ignore_cols = ['entry_id', 'last_updated']

        for hash_val in common_hashes:
            existing_entry = existing_indexed.loc[hash_val].drop(ignore_cols, errors='ignore').to_dict()
            new_entry = new_indexed.loc[hash_val].drop(ignore_cols, errors='ignore').to_dict()

            if existing_entry != new_entry:
                conflicts.append({
                    'hash': hash_val,
                    'existing': existing_indexed.loc[hash_val].to_dict(),
                    'new': new_indexed.loc[hash_val].to_dict()
                })
                hashes_with_conflicts.append(hash_val)

    if conflicts:
        print(f"Detected {len(conflicts)} conflicts. Writing to {conflicts_file}")
        with open(conflicts_file, 'w', encoding='utf-8') as f:
            json.dump(conflicts, f, indent=2)
        
        # Exclude conflicting entries from this update
        new_runners_df = new_runners_df[~new_runners_df['entry_hash'].isin(hashes_with_conflicts)]
        if new_runners_df.empty:
            print("All new entries have conflicts. 'all_runners.json' will not be updated until resolved.")
            return

    # --- Merge and Save Non-Conflicting Data ---
    updated_hashes = new_runners_df['entry_hash'].tolist()
    
    if not existing_df.empty:
        existing_df = existing_df[~existing_df['entry_hash'].isin(updated_hashes)]

    combined_df = pd.concat([existing_df, new_runners_df], ignore_index=True)

    combined_df['entry_id'] = pd.to_numeric(combined_df['entry_id'])
    combined_df = combined_df.sort_values(by="entry_id").reset_index(drop=True)
    combined_df['entry_id'] = combined_df['entry_id'].astype(str)

    final_data_list = combined_df.to_dict(orient='records')
    formatted_json_string = format_json_with_compact_sparks(final_data_list)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(formatted_json_string)

    print(f"Successfully updated {output_file} with {len(new_runners_df)} new/updated entries.")