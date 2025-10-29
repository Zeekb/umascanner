UMA Scanner Setup Guide
A simple guide to setting up and using the UMA Scanner.

This guide will help you install and use the UMA Scanner to get information from your screenshots.

!! NOTE !!
Running this for myself takes about 15 minutes for 200 entries, so go grab something to drink and put on a video!


Step -1: [Optional] Test UmaCyclopedia without running UmaScanner
To test the UmaCyclopedia runner filtering without installing requirements for the UmaScanner, you can use the `all-runners.json` from the release zip to test the UmaCyclopedia at zeekb.github.io/umascanner/.

---

Step 0: Download and Install Python

First, you need to install Python on your computer. This is required to install the PyTorch deep learning library to read the screenshots.

1.  Go to the official Python website (https://www.python.org/downloads/).
2.  Download the latest version of Python.
3.  When you install Python, make sure to check the box that says "Add Python to PATH". This is very important.
4.  To check if Python is installed correctly, open a program called "Terminal" or "Command Prompt" and type this command, then press Enter:

    python --version

---

Step 1: Install PyTorch

You have two options for installing PyTorch. Using a GPU is highly recommended for performance. (NVIDIA Only)

* Performance Note: Using a CPU is the most compatible option, but it is much slower. For a batch of 200 characters, processing can take up to 1 and a half on a CPU versus 15 minutes on a GPU.

---

OPTION 1: CPU Version (Recommended for compatibility)

This is the easiest option and will work on any machine.

* Download Size: ~700-900 MB
* Action: Double-click and run the `install_pytorch_cpu.bat` script.

---

OPTION 2: GPU Version (Recommended for performance)

This option requires a compatible NVIDIA GPU and provides a ~6x speed improvement.

* Download Size: ~2.5 GB
* Action: Follow these manual steps:
    1.  IMPORTANT: If you have ever installed PyTorch before, uninstall it first to avoid conflicts:
        
        pip uninstall torch torchvision torchaudio
        
    2.  Find your maximum supported CUDA version by running this command in your terminal:
        
        nvidia-smi
        
        Look for the "CUDA Version" in the top-right of the output (e.g., 12.2).
    3.  Go to the official PyTorch website (https://pytorch.org/get-started/locally/).
    4.  Use the website's tool to select your system settings and a CUDA version that is less than or equal to the one from the previous step.
    5.  Copy and run the generated `pip` command.

---

Step 2: Prepare Your Screenshots

1.  Put all your loose game screenshots into the `data/input_images` folder.

A quick note:

* Please use screenshots from a mobile phone. Screenshots from a computer will not work.

---

Step 3: Process Your Screenshots

1.  Run the main processing executable:
    
    UmaScanner.exe
    
2.  The script will perform the following steps automatically:
    * Groups Loose Images: Any loose screenshots in `data/input_images` are automatically organized into character folders.
    * Processes Data: It then extracts all stats, ranks, skills, sparks, and identifies grandparents for each character.
    * Handles Conflicts: If the script finds conflicting data, a Conflict Resolution window will appear.
    * Saves Results: The extracted data is saved in `data/all_runners.json`, and processed images are moved to `data/processed_images`.

---

Step 4: View Your Results

Use the UmaCyclopedia tool at zeekb.github.io/umascanner/.

You can load the `all_runners.json` file generated in Step 3 to view, sort, and filter all your scanned data.