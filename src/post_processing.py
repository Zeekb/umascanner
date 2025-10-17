import os
import json
from datetime import datetime
import pandas as pd
import logging

# --- Path Configuration ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_FOLDER = os.path.join(BASE_DIR, "runner_tables", "all_tables")

# --- Load Configuration ---
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.json'), 'r') as f:
    config = json.load(f)

DEFAULT_COLUMN_ORDER = config["DEFAULT_COLUMN_ORDER"]

logger = logging.getLogger(__name__)

def update_and_join_tables():
    
    tables_dir = OUTPUT_FOLDER # Use config
    output_file = os.path.join(os.path.dirname(tables_dir), 'all_runners.csv')
    error_file = os.path.join(os.path.dirname(tables_dir), f'all_runners_{datetime.now().strftime("%Y%m%d%H%M%S")}.csv')

    # Define file paths for individual CSVs
    entries_file = os.path.join(tables_dir, 'entries.csv')
    stats_file = os.path.join(tables_dir, 'stats.csv')
    rankings_file = os.path.join(tables_dir, 'rankings.csv')
    skills_file = os.path.join(tables_dir, 'skills.csv')
    sparks_file = os.path.join(tables_dir, 'sparks.csv')

    # Check if output directory exists
    if not os.path.exists(tables_dir):
        logger.warning(f"Output directory '{tables_dir}' not found. Nothing to join.")
        return

    # Load existing joined data if it exists
    existing_df = pd.DataFrame()
    if os.path.exists(output_file):
        try:
            existing_df = pd.read_csv(output_file, dtype={'entry_hash': str})
            logger.info(f"Loaded existing joined data from {output_file}.")
        except Exception as e:
            logger.error(f"Error loading existing all_runners.csv: {e}. A new file will be created at {error_file}.")
            output_file = error_file

    # Load new entries
    if not os.path.exists(entries_file) or os.stat(entries_file).st_size == 0:
        logger.warning("entries.csv not found or is empty. No new data to process.")
        return

    try:
        entries_df = pd.read_csv(entries_file, dtype={'entry_hash': str, 'entry_id': str})
        logger.info(f"Loaded new entries from {entries_file}.")
    except Exception as e:
        logger.error(f"Error loading entries.csv: {e}. Aborting join process.")
        return

    # Merge stats
    if os.path.exists(stats_file) and os.stat(stats_file).st_size > 0:
        stats_df = pd.read_csv(stats_file, dtype={'entry_id': str})
        stats_pivot = stats_df.pivot(index='entry_id', columns='stat_name', values='value')
        entries_df = entries_df.merge(stats_pivot, left_on='entry_id', right_index=True, how='left')
        logger.info(f"Merged stats from {stats_file}.")
    else:
        logger.info(f"Stats file {stats_file} not found or is empty. Skipping stats merge.")

    # Merge rankings
    if os.path.exists(rankings_file) and os.stat(rankings_file).st_size > 0:
        rankings_df = pd.read_csv(rankings_file, dtype={'entry_id': str})
        rankings_df['col_name'] = 'rank_' + rankings_df['subcategory']
        rankings_pivot = rankings_df.pivot(index='entry_id', columns='col_name', values='grade')
        entries_df = entries_df.merge(rankings_pivot, left_on='entry_id', right_index=True, how='left')
        logger.info(f"Merged rankings from {rankings_file}.")
    else:
        logger.info(f"Rankings file {rankings_file} not found or is empty. Skipping rankings merge.")

    # Merge skills
    if os.path.exists(skills_file) and os.stat(skills_file).st_size > 0:
        skills_df = pd.read_csv(skills_file, dtype={'entry_id': str})
        skills_grouped = skills_df.groupby('entry_id')['skill_name'].apply(lambda x: '|'.join(x)).reset_index(name='skills')
        entries_df = entries_df.merge(skills_grouped, on='entry_id', how='left')
        logger.info(f"Merged skills from {skills_file}.")
    else:
        logger.info(f"Skills file {skills_file} not found or is empty. Skipping skills merge.")

    # Merge sparks
    if os.path.exists(sparks_file) and os.stat(sparks_file).st_size > 0:
        sparks_df = pd.read_csv(sparks_file, dtype={'entry_id': str})
        # Convert sparks data to JSON string for storage
        sparks_grouped = sparks_df.groupby('entry_id').apply(lambda x: json.dumps(x[['type', 'color', 'spark_name', 'count']].to_dict(orient='records')), include_groups=False).reset_index(name='sparks')
        entries_df = entries_df.merge(sparks_grouped, on='entry_id', how='left')
        logger.info(f"Merged sparks from {sparks_file}.")
    else:
        logger.info(f"Sparks file {sparks_file} not found or is empty. Skipping sparks merge.")

    # Add last_updated timestamp
    entries_df['last_updated'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Combine with existing data
    if not existing_df.empty:
        existing_hashes = set(existing_df['entry_hash'])
        
        # Use entry_hash to update existing rows and add new ones
        combined_df = pd.concat([existing_df.set_index('entry_hash'), entries_df.set_index('entry_hash')])
        combined_df = combined_df[~combined_df.index.duplicated(keep='last')] # Keep the latest entry for each hash
        combined_df = combined_df.reset_index()

        # Identify new entries in the combined dataframe
        is_new_entry = ~combined_df['entry_hash'].isin(existing_hashes)
        
        # Assign new entry_ids to these new entries
        if is_new_entry.any():
            max_id = existing_df['entry_id'].max() if 'entry_id' in existing_df.columns and not existing_df.empty else 0
            num_new = is_new_entry.sum()
            new_ids = range(int(max_id) + 1, int(max_id) + 1 + num_new)
            combined_df.loc[is_new_entry, 'entry_id'] = new_ids

        # Ensure entry_id is int
        if 'entry_id' in combined_df.columns:
            combined_df['entry_id'] = combined_df['entry_id'].astype(int)

        logger.info("Combined new data with existing data.")
    else:
        combined_df = entries_df
        # First run, create entry_id
        if 'entry_id' in combined_df.columns:
            combined_df = combined_df.drop(columns=['entry_id'])
        combined_df.insert(0, 'entry_id', range(1, len(combined_df) + 1))

    # Reindex to enforce a consistent column order
    final_columns = [col for col in DEFAULT_COLUMN_ORDER if col in combined_df.columns]
    # Add any new columns not in DEFAULT_COLUMN_ORDER to the end
    final_columns.extend([col for col in combined_df.columns if col not in final_columns])
    combined_df = combined_df[final_columns]

    # Save the final combined data
    if not combined_df.empty:
        combined_df.to_csv(output_file, index=False)
        logger.info(f"Successfully updated and joined tables into '{output_file}'")
    else:
        logger.warning("No data found to write to joined_runners.csv.")
