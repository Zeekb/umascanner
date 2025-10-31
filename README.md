# UmaScanner v1.0.0 Release

go to [Release](https://github.com/Zeekb/umascanner/releases/tag/v1.0.0) page to download the latest version.

---

This is the first release of the UmaScanner backend for the [UmaCyclopedia](https://zeekb.github.io/umascanner/) project. Use this program to scan your game screenshots and generate the `all_runners.json` file needed for the runner analyzer. 

Time estimates used will vary depending on computer specification, generally it will be the time estimate or faster.

---

## Try It First with Sample Data!

Before you download the scanner, you can test the features of the UmaCyclopedia website with a sample data file. This will show you what the final result looks like and how the analyzer works.

1.  Download the `all_runners_Zeek.json` file attached to this release.
2.  Visit [UmaCyclopedia](https://zeekb.github.io/umascanner/).
3.  Upload the `all_runners_Zeek.json` file to see how you can sort, filter, and analyze the data.

---

There are two versions available: **CPU** and **GPU**.

---

## CPU Version (Recommended for ease of use)

This version is designed for maximum compatibility and works on most PCs without extra setup.

*   **Advantages**:
    *   Much smaller download size.
    *   Works out of the box with no additional installs.
*   **Disadvantages**:
    *   Significantly slower than the GPU version (e.g., ~6-30 seconds per character).

#### How to Use (CPU Version)
1.  Download and extract the `UmaScanner-CPU.zip` file.
2.  Place your mobile game screenshots into the `data/input_images` folder.
3.  Run `UmaScanner.exe`.
4.  Once processing is complete, find your results in the `data/all_runners.json` file.
5.  Upload this file to the [UmaCyclopedia](https://zeekb.github.io/umascanner/) tool to view and filter your umas.

---

## GPU Version (Recommended for performance)

This version uses an NVIDIA GPU to accelerate screenshot processing, offering a major speed improvement. It requires a one-time setup to install the necessary dependencies.

*   **Advantages**:
    *   Extremely fast (e.g., 2-5 seconds per character).
    *   Includes a conflict resolver for handling data inconsistencies.
*   **Disadvantages**:
    *   Extra setup
    *   Larger overall download size. (PyTorch size between 2-4 GB)
    *   Requires a compatible NVIDIA GPU.

### Setup Instructions (GPU Version)

You only need to do this once.

**Step 1: Install Python**
1.  Download and install the latest version of Python from the [official Python website](https://www.python.org/downloads/).
2.  **Crucially**, check the box that says **"Add Python to PATH"** during installation.
3.  Verify the installation by opening **Command Prompt** or **Terminal** and running `python --version`.

**Step 2: Install PyTorch with CUDA**
1.  Determine your GPU's maximum supported CUDA version by opening **Command Prompt** or **Terminal** and running the command:
    ```
    nvidia-smi
    ```
    Note the "CUDA Version" displayed in the top-right corner.

2.  Go to the [Official PyTorch Website](https://pytorch.org/get-started/locally/).

3.  Use the selection tool on the website to choose the following:
    *   **Build**: Stable
    *   **OS**: Windows
    *   **Package**: Pip
    *   **Language**: Python
    *   **Compute Platform**: Select a CUDA version that is **less than or equal to** the version you noted in the first step.

4.  Copy the generated command (it will start with `pip install torch...`) and run it in your **Command Prompt** or **Terminal**.

**Step 3: Configure the Runner**
1.  After PyTorch is installed, find its installation path by running this command:
    ```
    pip show torch
    ```
    Copy the path shown next to `Location:`.

2.  Open the `run_scanner_gpu.bat` file (included in the `.zip`) with a text editor.

3.  Replace `ADD_TORCH_PATH` with the path you just copied. The line should look something like this:
    ```batch
    set TORCH_PATH=C:\Users\YourUser\AppData\Local\Programs\Python\Python311\Lib\site-packages
    ```
4.  Save and close the file.

### How to Use (GPU Version)
1.  Download and extract the `UmaScanner-GPU.zip` file.
2.  Complete the one-time **Setup Instructions** above.
3.  Place your mobile game screenshots into the `data/input_images` folder.
4.  Run the `run_scanner_gpu.bat` file. **Do NOT run `UmaScanner_GPU.exe` directly.**
5.  Once processing is complete, find your results in the `data/all_runners.json` file.
6.  Upload this file to the [UmaCyclopedia](https://zeekb.github.io/umascanner/) website to view your results.
