import sys
import json
import os
# Import the custom formatter from your existing data_updater module
from data_updater import format_json_with_custom_layout

# Get the directory of the current script
# Get the directory of the current script (remains useful for imports like data_updater)
# BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# OUTPUT_FILE = os.path.join(BASE_DIR, "..", "data", "all_runners.json") # REMOVE THIS HARDCODED PATH

def main():
    try:
        if len(sys.argv) < 2:
            print("Error: Output file path not provided as command line argument.", file=sys.stderr)
            sys.exit(4) # Use a different exit code
        output_file_path = sys.argv[1]
        # Read the complete JSON data string from standard input
        json_data_string = sys.stdin.read()
        
        if not json_data_string:
            print("Error: No data received from stdin.", file=sys.stderr)
            sys.exit(1)

        # Parse the JSON string into a Python list
        all_runners_data = json.loads(json_data_string)
        
        # Use your existing custom formatter
        # NOTE: format_json_with_custom_layout expects 3 args now based on data_updater.py
        # If you simplified it back, adjust this call. Assuming it still needs the maps:
        # We need to load these within the script or receive them differently if needed.
        # For simplicity, let's assume format_json_with_custom_layout was simplified
        # If not, you'd need to adjust how skill maps are passed or loaded here.
        # --- Assuming simplified formatter for now: ---
        # formatted_json_string = format_json_with_custom_layout(all_runners_data)
        # --- If NOT simplified, you need to load/pass skill maps ---
        # Placeholder if not simplified (adjust loading as needed):
        try:
            # Attempt to load skill data relative to the script's location
            script_dir = os.path.dirname(os.path.abspath(__file__))
            game_data_dir = os.path.join(script_dir, "..", "data", "game_data")
            with open(os.path.join(game_data_dir, 'skills.json'), 'r', encoding='utf-8') as f:
                skills_data = json.load(f)
            with open(os.path.join(game_data_dir, 'runner_skills.json'), 'r', encoding='utf-8') as f:
                runner_unique_skills = json.load(f)
            skill_order_map = {name: i for i, name in enumerate(skills_data.keys())}
            formatted_json_string = format_json_with_custom_layout(all_runners_data, runner_unique_skills, skill_order_map)
        except Exception as e:
            print(f"Error loading skill data for formatting in Python script: {e}", file=sys.stderr)
            # Fallback to basic JSON dump if formatting data isn't available
            formatted_json_string = json.dumps(all_runners_data, indent=2, ensure_ascii=False)


        # Write the formatted string back to the specified file path
        # --- MODIFIED: Use the path from argv ---
        with open(output_file_path, 'w', encoding='utf-8') as f:
            f.write(formatted_json_string)
        # --- END MODIFICATION ---

        print(f"Successfully saved formatted data to {output_file_path}") # Use dynamic path in message
        sys.exit(0)

    except json.JSONDecodeError:
        print(f"Error: Invalid JSON received.", file=sys.stderr)
        sys.exit(2)
    except Exception as e:
        # Print any other errors to stderr
        print(f"An error occurred in save_formatted_json.py: {e}", file=sys.stderr)
        sys.exit(3)

if __name__ == "__main__":
    main()