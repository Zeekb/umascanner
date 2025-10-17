# UMA Scanner

UMA Scanner is a Python-based tool for extracting and analyzing data from screenshots of the mobile game *Umamusume: Pretty Derby*. It uses OCR to recognize character stats, skills, and sparks, then organizes the extracted information into structured CSV files.

## Project Structure

```
C:\Users\shack\Desktop\Repos\umascanner\
├───assets
│   ├───current_output.PNG
│   ├───SparkAreaExample.PNG
│   └───target_output.jpg
├───data
│   ├───game_data
│   │   ├───racers.json
│   │   ├───skills.json
│   │   ├───spark_correction_rules.json
│   │   └───sparks.json
│   ├───input_images
│   ├───processed_images
│   ├───legacy
│   └───profile_images
├───runner_tables
│   ├───all_runners.csv
│   └───all_tables
│       ├───entries.csv
│       ├───rankings.csv
│       ├───skills.csv
│       ├───sparks.csv
│       └───stats.csv
├───src
│   ├───config.json
│   ├───data_loader.py
│   ├───folder_creator.py
│   ├───image_utils.py
│   ├───main_parser.py
│   ├───image_processor.py
│   ├───ocr_utils.py
│   ├───post_processing.py
│   ├───rankings.py
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

## How to Run

1.  **Install Dependencies:**
    *   Run the `install_dependencies.bat` script or use `pip install -r requirements.txt`.

2.  **Prepare Images:**
    *   Place your *Umamusume* screenshots into the `data/input_images` folder.

3.  **Create Character Folders:**
    *   Run the `folder_creator.py` script from within the `src` directory:
        ```bash
        python src/folder_creator.py
        ```

4.  **Process Images and Select Spark ROIs:**
    *   Run the `image_processor.py` script from within the `src` directory:
        ```bash
        python src/image_processor.py
        ```
    *   A GUI will appear to guide you through selecting spark areas on your screenshots.

5.  **View the Results:**
    *   Run the `uma_analyzer_themed.py` script from within the `src` directory:
        ```bash
        python src/uma_analyzer_themed.py
        ```
    *   This application will display the data from `runner_tables/all_runners.csv`.

## How to Contribute

1.  **Fork the repository.**
2.  **Create a new branch for your feature or bug fix.**
3.  **Make your changes and commit them with clear messages.**
4.  **Push your changes to your fork.**
5.  **Create a pull request to the main repository.**

```