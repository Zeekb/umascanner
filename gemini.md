# UMA Scanner

UMA Scanner is a Python-based tool for extracting and analyzing data from screenshots of the mobile game *Umamusume: Pretty Derby*. It uses OCR to recognize character stats, skills, and sparks, then organizes the extracted information into structured CSV files.

## Project Structure

```
.
├───assets
│   ├───current_output.PNG
│   ├───SparkAreaExample.PNG
│   └───target_output.jpg
├───data
│   ├───all_runners.csv
│   ├───all_tables
│   │   ├───entries.csv
│   │   ├───rankings.csv
│   │   ├───skills.csv
│   │   ├───sparks.csv
│   │   └───stats.csv
│   ├───game_data
│   │   ├───racers.json
│   │   ├───skills.json
│   │   ├───spark_correction_rules.json
│   │   └───sparks.json
│   ├───input_images
│   ├───processed_images
│   ├───legacy
│   └───profile_images
├───src
│   ├───config.json
│   ├───data_loader.py
│   ├───folder_creator.py
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
│   ├───uma_analyzer_themed.py
│   └───__pycache__
├───install_dependencies.bat
├───README.md
└───requirements.txt
```

## Recent Changes

During the last session, the following changes were made to the project:

1.  **Fixed `UnboundLocalError` in `src/conflict_resolver.py`:** Corrected a bug where `new_data` was referenced before assignment in the `save_resolution` function.
2.  **Improved Spark Conflict Resolution:** Modified `src/post_processing.py` to sort spark lists consistently before comparison, resolving conflicts triggered solely by inconsistent spark ordering.
3.  **Removed `folder_name` column:** The `folder_name` column is no longer included in `all_runners.csv`.
4.  **Relocated `all_runners.csv`:** The `all_runners.csv` file is now saved in the `data` folder instead of the `runner_tables` folder.
5.  **Removed `runner_tables` folder:** The `runner_tables` directory has been deleted.
6.  **Updated File References:** All internal file references to `runner_tables` have been updated to `data`.
7.  **Updated `README.md`:** The `README.md` file has been updated to reflect the new project structure and workflow.
