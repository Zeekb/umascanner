UMA Scanner Setup Guide
A simple guide to setting up and using the UMA Scanner.

This guide will help you install and use the UMA Scanner to get information from your mobile game screenshots.

!! NOTE !!
Running this for myself takes about 20 minutes for 200 entries, so go grab something to drink and put on a video :)

---

## Step -1: [Optional] Remove my data from the program before running your own

If you don't want my runner data in your program, before doing anything, delete the `all-runners.csv` file in the `data` folder
I kept it in so people can play with the Analyzer (Described below) without putting in their own screenshots.

---

Step 0: Download and Install Python

First, you need to install Python on your computer.

1.  Go to the official Python website: https://www.python.org/downloads/
2.  Download the latest version of Python.
3.  When you install Python, make sure to check the box that says "Add Python to PATH". This is very important.
4.  To check if Python is installed correctly, open a program called "Terminal" or "Command Prompt" and type this command, then press Enter:

    python --version

---

Step 1: Install Extra Tools

Next, you need to install some extra tools that the UMA Scanner needs to work. Here are two ways to do it:

Method 1: Use the installation script (for Windows)

1.  Find the file named `install_dependencies.bat` and double-click on it.
2.  This will automatically install everything you need.

OR

Method 2: Use the `requirements.txt` file

1.  Open your "Terminal" or "Command Prompt" in the same folder where you have the UMA Scanner files.
2.  Type this command and press Enter:

    pip install -r requirements.txt

---

Step 2: Prepare Your Screenshots

1.  Put all your loose game screenshots into the `data/input_images` folder. The system will automatically organize them when you run the processor in the next step.

A quick note:

*   Please use screenshots from a mobile phone. Screenshots from a computer will not work.

---

Step 3: Process Your Screenshots

1.  Run the main processing script from your "Terminal" or "Command Prompt". Make sure you are in the project's root folder.

    python src/image_processor.py

2.  The script will first automatically group your images into character folders.
3.  If the script finds conflicting data for a character, a "Conflict Resolution" window may appear. This allows you to choose which data to keep.
4.  Once finished, the processed folders are moved to `data/processed_images`. The extracted data is saved in `data/all_runners.csv`.

---

Step 4: View Your Results

1.  To view the collected data, run the analyzer application from your "Terminal" or "Command Prompt":

    python src/uma_analyzer_themed.py

2.  This opens a graphical interface where you can see all your runners' data in a table. You can sort and filter the data.
3.  You can also double-click on a runner to see a detailed view.

    There's an image at "assets/ExampleAnalyzerView.png" as a reference for how the ui looks and what you can do with it.

---