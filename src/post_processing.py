import pandas as pd
import os
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def format_json_with_custom_layout(all_runners_data: list) -> str:
    """
    Custom JSON formatter that creates a highly readable, grouped, and semi-compact output.
    - Groups related keys onto single lines.
    - Formats the 'skills' array into a two-column layout.
    - Keeps the 'sparks' objects compact.
    """

    def build_line(runner_dict, keys):
        """Helper to build a single formatted line for a set of keys."""
        parts = []
        for key in keys:
            if key in runner_dict:
                value_str = json.dumps(runner_dict[key], ensure_ascii=False)
                if 'apt_' in key:   parts.append(f'"{key.split("_")[1]}": {value_str}')
                else:               parts.append(f'"{key}": {value_str}')
        return ", ".join(parts)

    output_parts = []
    for runner_index, runner_dict in enumerate(all_runners_data):
        # This list will hold all the formatted string blocks for the current entry.
        content_blocks = []

        # --- Define Key Groupings ---
        id_keys = ["entry_id", "last_updated", "entry_hash"]
        name_key = ["name"]
        score_key = ["score"]
        stat_keys = ["speed", "stamina", "power", "guts", "wit"]
        apt_keys = ["apt_turf", "apt_dirt", "apt_sprint", "apt_mile", "apt_medium", "apt_long", "apt_front", "apt_pace", "apt_late", "apt_end"]
        gp_keys = ["gp1", "gp2"]

        # --- Build Content Blocks for Each Group ---
        for keys in [id_keys, name_key, score_key, stat_keys, apt_keys, gp_keys]:
            line = build_line(runner_dict, keys)
            if line:
                content_blocks.append(f'    {line}')
        
        # --- Custom Formatting for Skills (Two-Column Layout) ---
        if 'skills' in runner_dict and runner_dict['skills']:
            skills_list = runner_dict['skills']
            
            # Split skills into two columns
            midpoint = (len(skills_list) + 1) // 2
            left_col = skills_list[:midpoint]
            right_col = skills_list[midpoint:]
            
            # Calculate max length for alignment padding
            # We use json.dumps to get the true length including quotes
            max_len = 0
            if left_col:
                max_len = max(len(json.dumps(s, ensure_ascii=False)) for s in left_col)

            formatted_skill_lines = []
            for i in range(len(left_col)):
                left_skill_str = json.dumps(left_col[i], ensure_ascii=False)
                line = f'      {left_skill_str}'
                
                if i < len(right_col):
                    right_skill_str = json.dumps(right_col[i], ensure_ascii=False)
                    # Add comma and padding for the second column
                    padding = ' ' * (max_len - len(left_skill_str) + 4)
                    line += f',{padding}{right_skill_str}'
                
                formatted_skill_lines.append(line)
            
            skills_block = '"skills": [\n' + ",\n".join(formatted_skill_lines) + '\n    ]'
            content_blocks.append(f'    {skills_block}')
        
        # --- Custom Formatting for Sparks (remains the same) ---
        if 'sparks' in runner_dict and runner_dict['sparks']:
            sparks_data = runner_dict['sparks']
            spark_parts = []
            for spark_type, spark_list in sparks_data.items():
                compact_spark_lines = [f"        {json.dumps(s, ensure_ascii=False)}" for s in spark_list]
                spark_block = f'"{spark_type}": [\n' + ",\n".join(compact_spark_lines) + '\n      ]'
                spark_parts.append(f'      {spark_block}')
            
            sparks_block = '"sparks": {\n' + ",\n".join(spark_parts) + '\n    }'
            content_blocks.append(f'    {sparks_block}')

        # --- Assemble the final entry ---
        runner_content = ",\n".join(content_blocks)
        output_parts.append("  {\n" + runner_content + "\n  }")

    # Join all runner entries and wrap in the main array brackets
    return "[\n" + ",\n".join(output_parts) + "\n]\n"


def update_all_runners(new_runners_df: pd.DataFrame):
    """
    Reads existing all_runners.json, detects conflicts, and updates the file
    with only non-conflicting new entries using a custom layout.
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
        new_runners_df = new_runners_df[~new_runners_df['entry_hash'].isin(hashes_with_conflicts)]
        if new_runners_df.empty:
            print("All new entries have conflicts. 'all_runners.json' will not be updated until resolved.")
            return

    updated_hashes = new_runners_df['entry_hash'].tolist()
    if not existing_df.empty:
        existing_df = existing_df[~existing_df['entry_hash'].isin(updated_hashes)]

    combined_df = pd.concat([existing_df, new_runners_df], ignore_index=True)
    combined_df['entry_id'] = pd.to_numeric(combined_df['entry_id'])
    combined_df = combined_df.sort_values(by="entry_id").reset_index(drop=True)
    combined_df['entry_id'] = combined_df['entry_id'].astype(str)

    # Use the new custom formatter
    final_data_list = combined_df.to_dict(orient='records')
    # Make sure to use the new function name here!
    formatted_json_string = format_json_with_custom_layout(final_data_list)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(formatted_json_string)

    print(f"Successfully updated {output_file} with {len(new_runners_df)} new/updated entries.")