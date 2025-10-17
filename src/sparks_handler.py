import os
import glob
import cv2
from tabs import detect_active_tab
from tkinter import Tk, Canvas, Button, Frame, BOTH
from PIL import Image, ImageTk

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

    def __init__(self, master, entries_dict):
        """
        entries_dict: dict of folder_name -> list of non-inspiration images
        """
        self.master = master
        self.entries = list(entries_dict.items())  # list of tuples: (folder_name, [image_paths])
        self.entry_index = 0
        self.rois = []
        self.all_rois = {}
        self.zoom_factor = 1.0
        self.pan_x = self.pan_y = 0
        self.selected_roi_index = None
        self.resizing_edge = None
        self.start_x = self.start_y = None
        self.rect_id = None
        self.undo_stack = []
        self.redo_stack = []

        frame = Frame(master)
        frame.pack(fill=BOTH, expand=True)
        self.canvas = Canvas(frame, bg="black")
        self.canvas.pack(fill=BOTH, expand=True)

        Button(master, text="Undo", command=self.undo_roi, font=("Arial", 20, "bold")).pack(side="left")
        Button(master, text="Redo", command=self.redo_roi, font=("Arial", 20, "bold")).pack(side="left")
        Button(master, text="Next Entry", command=self.next_entry, font=("Arial", 20, "bold")).pack(side="right")
        Button(master, text="Reset Crops", command=self.reset_rois, font=("Arial", 20, "bold")).pack(side="right")

        # Bindings
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

        self.master.after(100, self.load_image)

    # ---------------- Image Handling ----------------
    def load_image(self):
        # Get current folder_name and its inspiration images
        self.entry_name, self.image_paths = self.entries[self.entry_index]

        # Load combined image of only inspiration images
        self.img_original = combine_images_horizontally(self.image_paths)

        # Load previous ROIs for this entry if any
        self.rois = list(self.all_rois.get(self.entry_name, []))
        self.undo_stack = [list(self.rois)]
        self.redo_stack.clear()

        # Compute initial zoom & pan to fit canvas
        canvas_w, canvas_h = self.canvas.winfo_width(), self.canvas.winfo_height()
        self.zoom_factor = min(canvas_w / self.img_original.width, 1.0)
        img_width_scaled = int(self.img_original.width * self.zoom_factor)
        img_height_scaled = int(self.img_original.height * self.zoom_factor)
        self.pan_x = max(0, (canvas_w - img_width_scaled) // 2)
        bottom_offset = int(canvas_h * 0.2)
        self.pan_y = canvas_h - img_height_scaled + bottom_offset

        self.refresh_display()
        self.master.title(f"ROI Selector - Entry {self.entry_index + 1}/{len(self.entries)}")


    # ---------------- Refresh Display ----------------
    def refresh_display(self):
        if not hasattr(self, "img_original") or self.img_original is None:
            return  # No image yet
        w, h = int(self.img_original.width * self.zoom_factor), int(self.img_original.height * self.zoom_factor)
        display_image = self.img_original.resize((w, h), Image.Resampling.LANCZOS)
        self.tk_img = ImageTk.PhotoImage(display_image)
        self.canvas.delete("all")
        self.canvas.create_image(self.pan_x, self.pan_y, anchor="nw", image=self.tk_img)
        for roi in self.rois:
            x1, y1, x2, y2 = roi[1]
            self.canvas.create_rectangle(
                int(x1*self.zoom_factor+self.pan_x),
                int(y1*self.zoom_factor+self.pan_y),
                int(x2*self.zoom_factor+self.pan_x),
                int(y2*self.zoom_factor+self.pan_y),
                outline="green", width=2
            )


    # ---------------- ROI Drawing / Resize ----------------
    def detect_handle(self, x, y):
        for idx, roi in enumerate(self.rois):
            x1, y1, x2, y2 = roi[1]
            x1s, y1s, x2s, y2s = int(x1*self.zoom_factor+self.pan_x), int(y1*self.zoom_factor+self.pan_y), int(x2*self.zoom_factor+self.pan_x), int(y2*self.zoom_factor+self.pan_y)
            if abs(x-x1s)<=self.HANDLE_SIZE and abs(y-y1s)<=self.HANDLE_SIZE: return idx, 'top_left'
            if abs(x-x2s)<=self.HANDLE_SIZE and abs(y-y1s)<=self.HANDLE_SIZE: return idx, 'top_right'
            if abs(x-x1s)<=self.HANDLE_SIZE and abs(y-y2s)<=self.HANDLE_SIZE: return idx, 'bottom_left'
            if abs(x-x2s)<=self.HANDLE_SIZE and abs(y-y2s)<=self.HANDLE_SIZE: return idx, 'bottom_right'
            if abs(x-x1s)<=self.HANDLE_SIZE and y1s<y<y2s: return idx, 'left'
            if abs(x-x2s)<=self.HANDLE_SIZE and y1s<y<y2s: return idx, 'right'
            if abs(y-y1s)<=self.HANDLE_SIZE and x1s<x<x2s: return idx, 'top'
            if abs(y-y2s)<=self.HANDLE_SIZE and x1s<x<x2s: return idx, 'bottom'
        return None, None

    def on_mouse_move(self, event):
        _, edge = self.detect_handle(event.x, event.y)
        self.canvas.config(cursor='cross' if edge else 'arrow')

    def on_button_press(self, event):
        self.start_x, self.start_y = event.x, event.y
        self.selected_roi_index, self.resizing_edge = self.detect_handle(event.x, event.y)
        if self.selected_roi_index is not None:
            self.undo_stack.append(list(self.rois))
            self.redo_stack.clear()
        elif self.selected_roi_index is None:
            self.rect_id = self.canvas.create_rectangle(self.start_x, self.start_y, self.start_x, self.start_y, outline="green", width=2)

    def on_mouse_drag(self, event):
        if self.selected_roi_index is not None and self.resizing_edge:
            roi = self.rois[self.selected_roi_index]
            x1, y1, x2, y2 = roi[1]
            x1s, y1s, x2s, y2s = x1*self.zoom_factor+self.pan_x, y1*self.zoom_factor+self.pan_y, x2*self.zoom_factor+self.pan_x, y2*self.zoom_factor+self.pan_y
            nx, ny = event.x, event.y
            if 'left' in self.resizing_edge: x1s = nx
            if 'right' in self.resizing_edge: x2s = nx
            if 'top' in self.resizing_edge: y1s = ny
            if 'bottom' in self.resizing_edge: y2s = ny
            x1n = max(0, min(self.img_original.width, int((min(x1s, x2s)-self.pan_x)/self.zoom_factor)))
            y1n = max(0, min(self.img_original.height, int((min(y1s, y2s)-self.pan_y)/self.zoom_factor)))
            x2n = max(0, min(self.img_original.width, int((max(x1s, x2s)-self.pan_x)/self.zoom_factor)))
            y2n = max(0, min(self.img_original.height, int((max(y1s, y2s)-self.pan_y)/self.zoom_factor)))
            self.rois[self.selected_roi_index] = (roi[0], (x1n, y1n, x2n, y2n), roi[2])
            self.refresh_display()
        elif self.rect_id:
            self.canvas.coords(self.rect_id, self.start_x, self.start_y, event.x, event.y)

    def on_button_release(self, event):
        if self.selected_roi_index is None and self.rect_id:
            x1 = max(0, min(self.img_original.width, int((min(self.start_x, event.x)-self.pan_x)/self.zoom_factor)))
            y1 = max(0, min(self.img_original.height, int((min(self.start_y, event.y)-self.pan_y)/self.zoom_factor)))
            x2 = max(0, min(self.img_original.width, int((max(self.start_x, event.x)-self.pan_x)/self.zoom_factor)))
            y2 = max(0, min(self.img_original.height, int((max(self.start_y, event.y)-self.pan_y)/self.zoom_factor)))
            if x2>x1 and y2>y1:
                self.undo_stack.append(list(self.rois))
                self.redo_stack.clear()
                self.rois.append((self.entry_name, (x1, y1, x2, y2), list(self.image_paths)))
            self.rect_id = None
        self.selected_roi_index = None
        self.resizing_edge = None

    # ---------------- Undo/Redo/Reset ----------------
    def undo_roi(self):
        if self.undo_stack:
            self.redo_stack.append(list(self.rois))
            self.rois = list(self.undo_stack.pop())
            self.refresh_display()

    def redo_roi(self):
        if self.redo_stack:
            self.undo_stack.append(list(self.rois))
            self.rois = self.redo_stack.pop()
            self.refresh_display()

    def reset_rois(self):
        if self.rois:
            self.undo_stack.append(list(self.rois))
        self.rois.clear()
        self.redo_stack.clear()
        self.refresh_display()

    # ---------------- Zoom & Pan ----------------
    def on_zoom(self, event):
        factor = 1.1 if (event.num==4 or event.delta>0) else 1/1.1
        self.zoom_factor = min(5.0, max(0.2, self.zoom_factor*factor))
        self.refresh_display()

    def start_pan(self, event):
        self.pan_start_x, self.pan_start_y = event.x, event.y

    def do_pan(self, event):
        self.pan_x += event.x - self.pan_start_x
        self.pan_y += event.y - self.pan_start_y
        self.pan_start_x, self.pan_start_y = event.x, event.y
        self.refresh_display()

    # ---------------- Entry Navigation ----------------
    def next_entry(self):
        self.all_rois[self.entry_name] = list(self.rois)
        self.rois.clear()
        self.undo_stack.clear()
        self.redo_stack.clear()
        self.entry_index += 1
        if self.entry_index < len(self.entries):
            self.load_image()
        else:
            #print("All entries processed.")
            self.master.quit()
