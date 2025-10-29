import os
import glob
import cv2
import numpy as np
import threading
from tkinter import Tk, Canvas, Button, Frame, BOTH, font as tkFont, ttk
from PIL import Image, ImageTk
from roi_detector import detect_spark_zones
from tabs import detect_active_tab
import easyocr

# --- Umamusume Themed Colors (from uma_analyzer_themed.py) ---
UMA_LIGHT_BG = "#FFF8E1"
UMA_MEDIUM_BG = "#FFECB3"
UMA_DARK_BG = "#FFD54F"
UMA_ACCENT_PINK = "#FF80AB"
UMA_ACCENT_BLUE = "#82B1FF"
UMA_TEXT_DARK = "#424242"
UMA_TEXT_LIGHT = "#FFFFFF"

# ---------------- Utility Functions ----------------
def get_entries(input_folder):
    """
    Return a dict mapping folder_name -> list of inspiration image paths
    """
    entries = {}
    for folder_name in sorted(os.listdir(input_folder)):
        folder_path = os.path.join(input_folder, folder_name)
        if not os.path.isdir(folder_path):
            continue
        image_paths = sorted(glob.glob(os.path.join(folder_path, "*.*")))
        non_insp_images = []
        for img_path in image_paths:
            if detect_active_tab(img_path) == "inspiration":
                non_insp_images.append(img_path)
        if non_insp_images:
            entries[folder_name] = non_insp_images
    return entries

def combine_images_horizontally(image_paths):
    images = [Image.open(p).convert("RGB") for p in image_paths]
    total_width = sum(img.width for img in images)
    max_height = max(img.height for img in images)
    combined = Image.new("RGB", (total_width, max_height), (0, 0, 0))
    x_offset = 0
    for img in images:
        combined.paste(img, (x_offset, 0))
        x_offset += img.width
    return combined

# ---------------- ROI Selector ----------------
class ROISelector:
    HANDLE_SIZE = 8

    def __init__(self, master, entries_dict, processing_q):
        self.master = master
        self.master.configure(bg=UMA_LIGHT_BG)
        self.processing_queue = processing_q

        self.reader = easyocr.Reader(['en'])

        self.entries = list(entries_dict.items())
        self.entry_index = 0
        self.rois = []
        self.all_rois = {}
        self.zoom_factor = 1.0
        self.pan_x = self.pan_y = 0
        
        self.selected_roi_index = None
        self.resizing_edge = None
        self.start_x = self.start_y = None
        self.original_roi_for_drag = None
        self.move_axis = None
        self.undo_stack = []
        self.redo_stack = []

        self.preloaded_data = {}
        self.preloader_thread = None

        main_frame = Frame(master, bg=UMA_LIGHT_BG)
        main_frame.pack(fill=BOTH, expand=True)

        self.canvas = Canvas(main_frame, bg="black")
        self.canvas.pack(fill=BOTH, expand=True)

        self.button_frame = Frame(main_frame, bg=UMA_MEDIUM_BG, bd=1, relief="solid")
        self.button_frame.pack(fill="x", side="bottom", pady=5)

        button_font = tkFont.Font(family="Arial", size=14, weight="bold")

        undo_button = Button(self.button_frame, text="Undo", command=self.undo_roi, bg=UMA_ACCENT_BLUE, fg=UMA_TEXT_LIGHT, font=button_font, relief="flat", padx=10, pady=5)
        undo_button.pack(side="left", padx=10, pady=5)
        redo_button = Button(self.button_frame, text="Redo", command=self.redo_roi, bg=UMA_ACCENT_BLUE, fg=UMA_TEXT_LIGHT, font=button_font, relief="flat", padx=10, pady=5)
        redo_button.pack(side="left", padx=0, pady=5)
        next_button = Button(self.button_frame, text="Next Entry", command=self.next_entry, bg=UMA_ACCENT_BLUE, fg=UMA_TEXT_LIGHT, font=button_font, relief="flat", padx=10, pady=5)
        next_button.pack(side="right", padx=10, pady=5)
        
        style = ttk.Style(self.master)
        style.configure("Horizontal.TProgressbar",
                        background=UMA_ACCENT_BLUE,
                        troughcolor=UMA_MEDIUM_BG,
                        thickness=25)
        self.progress = ttk.Progressbar(self.canvas, mode='indeterminate', length=400)

        self.canvas.bind("<ButtonPress-1>", self.on_button_press)
        self.canvas.bind("<B1-Motion>", self.on_mouse_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_button_release)
        self.canvas.bind("<Motion>", self.on_mouse_move)
        self.canvas.bind("<MouseWheel>", self.on_zoom)
        self.canvas.bind("<Button-4>", self.on_zoom)
        self.canvas.bind("<Button-5>", self.on_zoom)
        self.canvas.bind("<ButtonPress-2>", self.start_pan)
        self.canvas.bind("<B2-Motion>", self.do_pan)
        self.master.bind("<Configure>", lambda e: self.refresh_display())

        self.master.after(100, self.load_next_image_threaded)

    def show_loading(self, is_loading, entry_name="", progress_text=""):
        if is_loading:
            self.canvas.delete("all")
            self.master.update_idletasks()
            cx = self.canvas.winfo_width() / 2
            cy = self.canvas.winfo_height() / 2

            self.canvas.create_text(cx, cy - 60, text=f"Loading: {entry_name}", 
                                    font=("Arial", 16, "bold"), fill=UMA_TEXT_LIGHT)
            self.canvas.create_text(cx, cy + 60, text=progress_text, 
                                    font=("Arial", 12), fill=UMA_TEXT_LIGHT)

            self.progress.place(in_=self.canvas, relx=0.5, rely=0.5, anchor='center')
            self.progress.start(10)
            for child in self.button_frame.winfo_children():
                child.config(state='disabled')
            self.master.update_idletasks()
        else:
            self.progress.stop()
            self.progress.place_forget()
            for child in self.button_frame.winfo_children():
                child.config(state='normal')

    def load_next_image_threaded(self):
        if not self.entries or self.entry_index >= len(self.entries):
            self.master.quit()
            return
        
        entry_name = self.entries[self.entry_index][0]
        progress_text = f"{self.entry_index + 1}/{len(self.entries)}"
        self.show_loading(True, entry_name=entry_name, progress_text=progress_text)

        thread = threading.Thread(target=self._load_image_worker, args=(self.entry_index,))
        thread.daemon = True
        thread.start()

    def _load_image_worker(self, index):
        entry_name, image_paths = self.entries[index]
        try:
            img_original = combine_images_horizontally(image_paths)
            img_cv = cv2.cvtColor(np.array(img_original), cv2.COLOR_RGB2BGR)
            detected_rois = detect_spark_zones(img_cv, self.reader)
            rois = [(entry_name, roi, image_paths) for roi in detected_rois]
            self.master.after(0, self.on_load_complete, entry_name, img_original, rois)
        except Exception as e:
            print(f"Error processing {entry_name}: {e}")
            self.master.after(0, self.on_load_error)

    def _start_preloading_next_entry(self):
        next_index = self.entry_index + 1
        if next_index >= len(self.entries):
            return
        if next_index in self.preloaded_data or (self.preloader_thread and self.preloader_thread.is_alive()):
            return

        self.preloader_thread = threading.Thread(target=self._preloader_worker, args=(next_index,))
        self.preloader_thread.daemon = True
        self.preloader_thread.start()

    def _preloader_worker(self, target_index):
        entry_name, image_paths = self.entries[target_index]
        try:
            img_original = combine_images_horizontally(image_paths)
            img_cv = cv2.cvtColor(np.array(img_original), cv2.COLOR_RGB2BGR)
            detected_rois = detect_spark_zones(img_cv, self.reader)
            rois = [(entry_name, roi, image_paths) for roi in detected_rois]
            self.preloaded_data[target_index] = (entry_name, img_original, rois)
        except Exception as e:
            print(f"Error pre-loading {entry_name}: {e}")

    def on_load_error(self):
        self.show_loading(False)
        self.next_entry()

    def on_load_complete(self, entry_name, img_original, rois):
        self.show_loading(False)
        self.entry_name = entry_name
        self.img_original = img_original
        self.rois = rois
        self.undo_stack = [list(self.rois)]
        self.redo_stack.clear()

        canvas_w = self.canvas.winfo_width()
        canvas_h = self.canvas.winfo_height()
        if self.img_original.width > 0 and self.img_original.height > 0 and canvas_w > 0 and canvas_h > 0:
            self.zoom_factor = min(canvas_w / self.img_original.width, 1.0)
            img_width_scaled = int(self.img_original.width * self.zoom_factor)
            img_height_scaled = int(self.img_original.height * self.zoom_factor)
            self.pan_x = max(0, (canvas_w - img_width_scaled) // 2)
            bottom_offset = int(canvas_h * 0.2)
            self.pan_y = canvas_h - img_height_scaled + bottom_offset
        else:
            self.zoom_factor = 1.0
            self.pan_x = 0
            self.pan_y = 0

        self.refresh_display()
        self.master.title(f"ROI Selector - Entry {self.entry_index + 1}/{len(self.entries)}: {self.entry_name}")
        self._start_preloading_next_entry()

    def next_entry(self):
        if hasattr(self, 'entry_name'):
            # Add a copy of the completed entry to the processing queue
            self.processing_queue.put((self.entry_name, self.rois.copy()))

        self.rois.clear()
        self.undo_stack.clear()
        self.redo_stack.clear()
        
        self.entry_index += 1

        if self.entry_index >= len(self.entries):
            self.master.quit()
            return

        if self.entry_index in self.preloaded_data:
            entry_name, img_original, rois = self.preloaded_data.pop(self.entry_index)
            self.on_load_complete(entry_name, img_original, rois)
        else:
            self.load_next_image_threaded()

    def refresh_display(self):
        if not hasattr(self, "img_original") or self.img_original is None:
            return
        w = int(self.img_original.width * self.zoom_factor)
        h = int(self.img_original.height * self.zoom_factor)
        if w <= 0 or h <= 0: return

        display_image = self.img_original.resize((w, h), Image.Resampling.LANCZOS)
        self.tk_img = ImageTk.PhotoImage(display_image)
        self.canvas.delete("all")
        self.canvas.create_image(self.pan_x, self.pan_y, anchor="nw", image=self.tk_img)
        self.refresh_rois_only()

    def refresh_rois_only(self):
        self.canvas.delete("roi")
        for roi in self.rois:
            x1, y1, x2, y2 = roi[1]
            self.canvas.create_rectangle(
                int(x1 * self.zoom_factor + self.pan_x),
                int(y1 * self.zoom_factor + self.pan_y),
                int(x2 * self.zoom_factor + self.pan_x),
                int(y2 * self.zoom_factor + self.pan_y),
                outline=UMA_ACCENT_PINK, width=3, tags="roi"
            )

    def detect_handle(self, x, y):
        for idx, roi in enumerate(self.rois):
            x1, y1, x2, y2 = roi[1]
            x1s, y1s, x2s, y2s = int(x1*self.zoom_factor+self.pan_x), int(y1*self.zoom_factor+self.pan_y), int(x2*self.zoom_factor+self.pan_x), int(y2*self.zoom_factor+self.pan_y)
            if abs(y-y2s)<=self.HANDLE_SIZE and x1s<x<x2s: return idx, 'bottom'
            if x1s < x < x2s and y1s < y < y2s: return idx, 'move'
        return None, None

    def on_mouse_move(self, event):
        if self.selected_roi_index is None:
            _, edge = self.detect_handle(event.x, event.y)
            if edge:
                if edge == 'move':
                    self.canvas.config(cursor='fleur')
                elif edge == 'bottom':
                    self.canvas.config(cursor='sb_v_double_arrow')
            else:
                self.canvas.config(cursor='arrow')

    def on_button_press(self, event):
        self.start_x, self.start_y = event.x, event.y
        self.selected_roi_index, self.resizing_edge = self.detect_handle(event.x, event.y)
        if self.selected_roi_index is not None:
            self.undo_stack.append(list(self.rois))
            self.redo_stack.clear()
            if self.resizing_edge == 'move':
                self.original_roi_for_drag = self.rois[self.selected_roi_index][1]
                self.move_axis = None

    def on_mouse_drag(self, event):
        if self.selected_roi_index is not None and self.resizing_edge:
            roi = self.rois[self.selected_roi_index]
            if self.resizing_edge == 'move':
                dx = (event.x - self.start_x) / self.zoom_factor
                dy = (event.y - self.start_y) / self.zoom_factor
                if self.move_axis is None:
                    self.move_axis = 'horizontal' if abs(dx) > abs(dy) else 'vertical'
                x1, y1, x2, y2 = self.original_roi_for_drag
                if self.move_axis == 'horizontal':
                    new_x1, new_x2 = x1 + dx, x2 + dx
                    new_y1, new_y2 = y1, y2
                else:
                    new_y1, new_y2 = y1 + dy, y2 + dy
                    new_x1, new_x2 = x1, x2
                img_w, img_h = self.img_original.width, self.img_original.height
                roi_w, roi_h = new_x2 - new_x1, new_y2 - new_y1
                new_x1 = max(0, min(new_x1, img_w - roi_w))
                new_y1 = max(0, min(new_y1, img_h - roi_h))
                new_x2 = new_x1 + roi_w
                new_y2 = new_y1 + roi_h
                self.rois[self.selected_roi_index] = (roi[0], (new_x1, new_y1, new_x2, new_y2), roi[2])
            elif self.resizing_edge == 'bottom':
                x1, y1, x2, y2 = roi[1]
                y1s, y2s = y1*self.zoom_factor+self.pan_y, y2*self.zoom_factor+self.pan_y
                ny = event.y
                if 'bottom' in self.resizing_edge: y2s = ny
                y1n = max(0, min(self.img_original.height, int((min(y1s, y2s)-self.pan_y)/self.zoom_factor)))
                y2n = max(0, min(self.img_original.height, int((max(y1s, y2s)-self.pan_y)/self.zoom_factor)))
                self.rois[self.selected_roi_index] = (roi[0], (x1, y1n, x2, y2n), roi[2])
            self.refresh_rois_only()

    def on_button_release(self, event):
        self.selected_roi_index = None
        self.resizing_edge = None
        self.original_roi_for_drag = None
        self.move_axis = None
        self.canvas.config(cursor='arrow')

    def undo_roi(self):
        if len(self.undo_stack) > 1:
            self.redo_stack.append(list(self.rois))
            self.rois = list(self.undo_stack.pop())
            self.refresh_rois_only()

    def redo_roi(self):
        if self.redo_stack:
            self.undo_stack.append(list(self.rois))
            self.rois = self.redo_stack.pop()
            self.refresh_rois_only()

    def on_zoom(self, event):
        factor = 1.1 if (event.num == 4 or event.delta > 0) else 1 / 1.1
        self.zoom_factor = min(5.0, max(0.2, self.zoom_factor * factor))
        self.refresh_display()

    def start_pan(self, event):
        self.pan_start_x, self.pan_start_y = event.x, event.y

    def do_pan(self, event):
        self.pan_x += event.x - self.pan_start_x
        self.pan_y += event.y - self.pan_start_y
        self.pan_start_x, self.pan_start_y = event.x, event.y
        self.refresh_display()
