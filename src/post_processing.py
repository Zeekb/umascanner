import os
import json
import pandas as pd
import logging

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
logger = logging.getLogger(__name__)

def update_all_runners(new_runners_df):
    output_file = os.path.join(BASE_DIR, "data", "all_runners.csv")

    try:
        existing_df = pd.read_csv(output_file, dtype={'entry_hash': str})
        logger.info(f"Loaded existing joined data from {output_file}.")
    except FileNotFoundError:
        existing_df = pd.DataFrame()
    except Exception as e:
        logger.error(f"Error loading {output_file}: {e}. Starting with an empty DataFrame.")
        existing_df = pd.DataFrame()

    if not new_runners_df.empty:
        if not existing_df.empty:
            conflicts_file = os.path.join(BASE_DIR, 'data', 'conflicts.json')
            conflicts = []
            hashes_to_exclude_from_new = []

            existing_df_indexed = existing_df.set_index('entry_hash')
            new_runners_df_indexed = new_runners_df.set_index('entry_hash')

            common_hashes = new_runners_df_indexed.index.intersection(existing_df_indexed.index)

            ignore_cols = ['entry_id', 'last_updated']

            for hash_val in common_hashes:
                existing_entry = existing_df_indexed.loc[hash_val].drop(ignore_cols, errors='ignore')
                new_entry = new_runners_df_indexed.loc[hash_val].drop(ignore_cols, errors='ignore')

                type_order = {'representative': 0, 'legacy': 1}
                color_order = {'blue': 0, 'pink': 1, 'green': 2, 'white': 3}
                # Normalize sparks column before comparison
                if 'sparks' in existing_entry and (pd.isna(existing_entry['sparks']) or existing_entry['sparks'] == ''):
                    existing_entry['sparks'] = '[]'
                else:
                    try:
                        sparks_list = json.loads(existing_entry['sparks'])
                        sparks_list.sort(key=lambda s: (
                            type_order.get(s['type'], 99),
                            color_order.get(s['color'], 99),
                            s['spark_name']
                        ))
                        existing_entry['sparks'] = json.dumps(sparks_list)
                    except (json.JSONDecodeError, TypeError):
                        pass # Keep original if not valid JSON
    
                if 'sparks' in new_entry and (pd.isna(new_entry['sparks']) or new_entry['sparks'] == ''):
                    new_entry['sparks'] = '[]'
                else:
                    try:
                        sparks_list = json.loads(new_entry['sparks'])
                        sparks_list.sort(key=lambda s: (
                            type_order.get(s['type'], 99),
                            color_order.get(s['color'], 99),
                            s['spark_name']
                        ))
                        new_entry['sparks'] = json.dumps(sparks_list)
                    except (json.JSONDecodeError, TypeError):
                        pass # Keep original if not valid JSON
    
                if not existing_entry.fillna('').to_dict() == new_entry.fillna('').to_dict():
                    conflicts.append({
                        'hash': hash_val,
                        'existing': existing_df_indexed.loc[hash_val].fillna('').to_dict(),
                        'new': new_runners_df_indexed.loc[hash_val].fillna('').to_dict()
                    })
                    hashes_to_exclude_from_new.append(hash_val)

            if conflicts:
                existing_conflicts = []
                if os.path.exists(conflicts_file):
                    with open(conflicts_file, 'r') as f:
                        try:
                            existing_conflicts = json.load(f)
                        except json.JSONDecodeError:
                            logger.warning("Could not decode existing conflicts file. It will be overwritten.")
                
                existing_conflict_hashes = {c['hash'] for c in existing_conflicts}
                for conflict in conflicts:
                    if conflict['hash'] not in existing_conflict_hashes:
                        existing_conflicts.append(conflict)
                
                with open(conflicts_file, 'w') as f:
                    json.dump(existing_conflicts, f, indent=4)
                logger.warning(f"Found {len(conflicts)} new conflicts. Total unresolved conflicts: {len(existing_conflicts)}. Please resolve them using the UI.")

            if hashes_to_exclude_from_new:
                new_runners_df = new_runners_df[~new_runners_df['entry_hash'].isin(hashes_to_exclude_from_new)]

            combined_df = pd.concat([existing_df, new_runners_df], ignore_index=True)
            combined_df.drop_duplicates(subset=['entry_hash'], keep='last', inplace=True)
        else:
            combined_df = new_runners_df
    else:
        combined_df = existing_df

    if not combined_df.empty:
        if 'entry_id' in combined_df.columns:
            combined_df['entry_id'] = pd.to_numeric(combined_df['entry_id'])
            combined_df.sort_values('entry_id', inplace=True)

        combined_df = combined_df.drop(columns=['folder_name'], errors='ignore')
        combined_df.to_csv(output_file, index=False)
        logger.info(f"Successfully updated {output_file}")