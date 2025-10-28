import sys
import json
import os
# Import the custom formatter from your existing data_updater module
from data_updater import format_json_with_custom_layout

# Get the directory of the current script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Set the output file path relative to this script (../data/all_runners.json)
OUTPUT_FILE = os.path.join(BASE_DIR, "..", "data", "all_runners.json")

def main():
    try:
        # Read the complete JSON data string from standard input
        json_data_string = sys.stdin.read()
        
        if not json_data_string:
            print("Error: No data received from stdin.", file=sys.stderr)
            sys.exit(1)

        # Parse the JSON string into a Python list
        all_runners_data = json.loads(json_data_string)
        
        # Use your existing custom formatter
        formatted_json_string = format_json_with_custom_layout(all_runners_data)
        
        # Write the formatted string back to the all_runners.json file
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write(formatted_json_string)
        
        print(f"Successfully saved formatted data to {OUTPUT_FILE}")
        sys.exit(0)

    except json.JSONDecodeError:
        print(f"Error: Invalid JSON received.", file=sys.stderr)
        sys.exit(2)
    except Exception as e:
        # Print any other errors to stderr
        print(f"An error occurred: {e}", file=sys.stderr)
        sys.exit(3)

if __name__ == "__main__":
    main()