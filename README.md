# UMA Scanner Setup Guide
A simple guide to setting up and using the UMA Scanner.

This guide will help you install and use the UMA Scanner to get information from your screenshots.

---



## Step 0: Download and Install Python

First, you need to install Python on your computer.

1.  Go to the [official Python website](https://www.python.org/downloads/).
2.  Download the latest version of Python.
3.  When you install Python, make sure to check the box that says **"Add Python to PATH"**. This is very important.
4.  To check if Python is installed correctly, open a program called **Terminal** or **Command Prompt** and type this command, then press Enter:

    ```bash
    python --version
    ```

---

## Step 1: Install Extra Tools

Next, you need to install some extra tools that the UMA Scanner needs to work. Here are two ways to do it:

**Method 1: Use the installation script (for Windows)**

1.  Find the file named `install_dependencies.bat` and double-click on it.
2.  This will automatically install everything you need.

**OR**

**Method 2: Use the `requirements.txt` file**

1.  Open your **Terminal** or **Command Prompt** in the same folder where you have the UMA Scanner files.
2.  Type this command and press Enter:

    ```bash
    pip install -r requirements.txt
    ```

---

## Step 2: Prepare Your Screenshots

1.  Put all your loose game screenshots into the `data/input_images` folder. The system will automatically organize them when you run `image_processor.py` in step 3.

**A quick note:**

*   Please use screenshots from a mobile phone. Screenshots from a computer will not work.

---

## Step 3: Process Your Screenshots

1.  Run the main processing script from your **Terminal** or **Command Prompt**. Make sure you are in the project's root folder.

    ```bash
    python src/image_processor.py
    ```

2.  The script will first automatically group any loose images in `data/input_images` into character folders.
3.  Next, a new window will open for **Spark Area Confirmation**. The program automatically detects the "spark" areas on your screenshots. Your task is to review these automatically drawn boxes for each character and adjust them if they are incorrect.
    *   Use the example image at `assets/SparkAreaExample.PNG` as a reference for how the boxes should look.
    <img src="assets/SparkAreaExample.PNG" alt="SparkAreaExample.PNG" width="1200"/>
4.  After you confirm the spark areas for all characters, the script will process all the information.
5.  If the script finds conflicting data for a character that has been processed before (e.g., you are re-processing updated screenshots), a **Conflict Resolution** window may appear. This allows you to choose which data to keep.
6.  Once finished, the processed character folders will be moved from `data/input_images` to `data/processed_images`. The extracted data is saved in `data/all_runners.csv`.

---

## Step 4: View Your Results

1.  To view the collected data, run the analyzer application from your **Terminal** or **Command Prompt**:

    ```bash
    python src/uma_analyzer_themed.py
    ```

2.  This opens a graphical interface where you can see all your runners' data in a sortable and filterable table.
   
3.  You can double-click on any runner in the "Stats Summary" tab to see a detailed view of their stats, skills, and aptitudes.
    *   Here's an image at `assets/ExampleAnalyzerView.png` as a reference for how the ui looks and what you can do with it.
    <img src="assets/ExampleAnalyzerView.png" alt="SparkAreaExample.PNG" width="1800"/>

---