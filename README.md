# UMA Scanner Setup Guide
A simple guide to setting up and using the UMA Scanner.

This guide will help you install and use the UMA Scanner to get information from your screenshots.


!! NOTE !!
Running this for myself takes about 20 minutes for 200 entries, so go grab something to drink and put on a video :)


## Step -1: [Optional] Add my data for the program before running your own

If you want to play with my runner data in your program, before doing anything, change the `all-runners_Zeek.csv` file in the `data` folder to `all-runners.csv`.
I kept it in so people can play with the **Analyzer** (Described below) without putting in their own screenshots.


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

## Step 1a: [Optional RECOMMENDED] Enabling GPU Acceleration

For a significant performance increase, it is HIGHLY recommended to run the OCR process on an NVIDIA GPU. The default installation uses the CPU to ensure compatibility across all machines. With an expected batch size of up to 200 entries this is the difference between **20 minutes and 2 hours**, well worth the time.

**Performance Comparison:**
Based on a test with 5 character folders:
*   **CPU Time:** 205 seconds
*   **GPU Time:** 33 seconds

This is a **~6x speed improvement**.

To enable GPU acceleration, you must manually install a version of PyTorch that supports your specific hardware. The application is configured to use the GPU by default (`"gpu": true` in `src/config.json`), but it will only work if you complete these steps.

**Requirements:**
1.  An NVIDIA GPU.
2.  Correctly installed NVIDIA drivers.
3.  The NVIDIA CUDA Toolkit.

**Installation:**
1.  **IMPORTANT:** Uninstall the existing CPU-only version of PyTorch first to avoid conflicts:
    ```bash
    pip uninstall torch torchvision torchaudio
    ```
2.  Check your driver's maximum supported CUDA version by running this command in your terminal:
    ```bash
    nvidia-smi
    ```
    Look for the "CUDA Version" in the top-right of the output. Your driver can support any CUDA version *up to* this number.
3.  Go to the [official PyTorch website](https://pytorch.org/get-started/locally/).
4.  Use the "PyTorch Build" selector to choose the options that match your system. For the CUDA option, pick a version that is less than or equal to the one you found in the previous step.
5.  Copy the generated command (e.g., `pip3 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118`).
6.  Run the installation command from the PyTorch website in your Terminal or Command Prompt.
7.  After this is complete, the `install_dependencies.bat` script can be run, or if you have already run it, the program will now use your GPU.

If you enable GPU in the config but do not have a proper GPU setup, the program will fall back to the CPU and you will see a warning message.

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

2.  The script will perform the following steps automatically:
    *   **Groups Loose Images:** Any loose screenshots in `data/input_images` are automatically organized into character folders based on their name and score.
    *   **Detects ROIs:** The script automatically detects the spark information regions from your screenshots.
    *   **Processes Data:** It then extracts all stats, ranks, skills, and sparks for each character.
    *   **Handles Conflicts:** If the script finds conflicting data for a character that has been processed before (e.g., you are re-processing updated screenshots), a **Conflict Resolution** window will appear. This allows you to choose which data to keep.
    *   **Saves Results:** The extracted data is saved in `data/all_runners.csv`, and the processed character folders are moved from `data/input_images` to `data/processed_images`.

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
