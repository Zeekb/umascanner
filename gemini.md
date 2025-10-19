# UMA Scanner

UMA Scanner is a Python-based tool for extracting and analyzing data from screenshots of the mobile game *Umamusume: Pretty Derby*. It uses OCR to recognize character stats, skills, and sparks, then organizes the extracted information into structured CSV files.

## Project Structure

```
.
├───assets
│   ├───profile_images
│   └───ExampleAnalyzerView.png
├───data
│   ├───all_runners.csv
│   ├───game_data
│   │   ├───racers.json
│   │   ├───skills.json
│   │   └───sparks.json
│   ├───input_images
│   └───processed_images
├───src
│   ├───config.json
│   ├───conflict_resolver.py
│   ├───data_loader.py
│   ├───image_processor.py
│   ├───image_utils.py
│   ├───main_parser.py
│   ├───ocr_utils.py
│   ├───post_processing.py
│   ├───rankings.py
│   ├───roi_detector.py
│   ├───schema.py
│   ├───spark_parser.py
│   ├───sparks_handler.py
│   ├───tabs.py
│   └───uma_analyzer_themed.py
├───install_dependencies.bat
├───README.md
├───README.txt
└───requirements.txt
```

## File Descriptions

### `src` directory

*   **`image_processor.py`**: The main script that orchestrates the entire data extraction process. It groups loose images, detects ROIs, processes character data in parallel, and handles data conflicts.
*   **`uma_analyzer_themed.py`**: A PyQt5-based GUI application for viewing, sorting, and filtering the extracted runner data from `all_runners.csv`.
*   **`main_parser.py`**: Responsible for parsing the main character information, including stats, rankings, and skills from screenshots.
*   **`spark_parser.py`**: Parses spark details (color, name, count) from the detected spark ROIs.
*   **`roi_detector.py`**: Automatically detects the regions of interest (ROIs) for spark information on combined screenshots.
*   **`conflict_resolver.py`**: A PyQt5 GUI that launches when the `image_processor` detects conflicting data for an existing character, allowing the user to choose which data to keep.
*   **`post_processing.py`**: Handles the logic for updating the main `all_runners.csv` file, comparing new data with existing data, and flagging conflicts.
*   **`data_loader.py`**: Loads static game data, such as lists of known racers, skills, and sparks, from the `data/game_data` directory.
*   **`ocr_utils.py`**: Provides utility functions for the OCR process, primarily for cleaning and fuzzy-matching text against known game data.
*   **`image_utils.py`**: Contains helper functions for common image manipulation tasks like loading images, cropping ROIs, and selecting layouts.
*   **`schema.py`**: Defines the Python dataclasses used to structure the character data during processing.
*   **`rankings.py`**: Specifically handles the parsing of the aptitude (ranking) table from screenshots by analyzing the color of the grades.
*   **`tabs.py`**: A utility to detect which tab (e.g., "skills" or "inspiration") is active in a screenshot.
*   **`sparks_handler.py`**: Contains a legacy Tkinter-based GUI for manual ROI selection. While still in the codebase, the primary workflow now uses automatic detection from `roi_detector.py`.
*   **`config.json`**: A configuration file that stores various settings for the application, such as OCR parameters, ROI coordinates, and color values for grade detection.

### `data` directory

*   **`all_runners.csv`**: The main output file where all extracted and processed character data is stored.
*   **`input_images/`**: The folder where users should place their game screenshots for processing.
*   **`processed_images/`**: After processing, the image folders are moved from `input_images` to this directory.
*   **`game_data/`**: Contains JSON files with static game information used for OCR normalization and data enrichment (e.g., `racers.json`, `skills.json`, `sparks.json`).