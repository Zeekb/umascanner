import sys
import pandas as pd
import json
import os
import re
import logging
import ctypes

# Configure logging to file
logging.basicConfig(filename='app.log', level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')

class StreamToLogger(object):
    """Fake file-like stream object that redirects writes to a logger instance."""
    def __init__(self, logger, level):
        self.logger = logger
        self.level = level
        self.linebuf = ''

    def write(self, buf):
        for line in buf.rstrip().splitlines():
            self.logger.log(self.level, line.rstrip())

    def flush(self):
        pass

# Redirect stdout and stderr to logging
sys.stdout = StreamToLogger(logging.getLogger('STDOUT'), logging.INFO)
sys.stderr = StreamToLogger(logging.getLogger('STDERR'), logging.ERROR)

from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QTabWidget, QTableWidget, QTableWidgetItem, QDockWidget, QLabel,
    QComboBox, QLineEdit, QCheckBox, QSlider, QHeaderView, QPushButton,
    QStyledItemDelegate, QStyle, QFrame, QDialog, QScrollArea, QGroupBox, QVBoxLayout, QHBoxLayout, QGridLayout, QRadioButton, QGraphicsDropShadowEffect
)
from PyQt5.QtGui import QColor, QTextDocument, QFont, QPixmap, QPainter, QPainterPath, QPen, QFontMetrics
from PyQt5.QtCore import Qt, QRect

class OutlineLabel(QLabel):
    def __init__(self, text="", parent=None, outline_color=Qt.black, outline_width=3, text_color=Qt.white, force_left_align=False):
        super().__init__(text, parent)
        self._outline_color = QColor(outline_color) if not isinstance(outline_color, QColor) else outline_color
        self._outline_width = outline_width
        self._text_color = QColor(text_color) if not isinstance(text_color, QColor) else text_color
        self._force_left_align = force_left_align
        self._text_gradient_colors = None

    def setOutlineColor(self, color):
        self._outline_color = QColor(color) if not isinstance(color, QColor) else color
        self.update()

    def setOutlineWidth(self, width):
        self._outline_width = width
        self.update()

    def setTextColor(self, color):
        self._text_color = QColor(color) if not isinstance(color, QColor) else color
        self.update()

    def setTextGradient(self, color_top, color_bottom):
        """Sets a vertical gradient for the text fill."""
        self._text_gradient_colors = (QColor(color_top), QColor(color_bottom))
        self._text_color = QColor(color_top)
        self.update()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        # Remove HTML tags for drawing
        plain_text = re.sub(r'<[^>]+>', '', self.text())

        metrics = painter.fontMetrics()
        
        main_text = plain_text
        plus_text = ""
        if plain_text.endswith('+'):
            main_text = plain_text[:-1]
            plus_text = '+'

        # Calculate position for main text
        if self._force_left_align:
            x_main = 5 # Left-aligned with padding
            # Calculate y_main for left-aligned text
            text_height = metrics.height()
            y_main = (self.height() - text_height) / 2 + metrics.ascent()
        else:
            main_text_rect = metrics.boundingRect(self.rect(), Qt.AlignCenter, main_text)
            x_main = main_text_rect.x()
            y_main = main_text_rect.y() + metrics.ascent() # Adjust y to be baseline

        # Create QPainterPath for main text
        path_main = QPainterPath()
        if main_text: # Only add text if it's not an empty string
            path_main.addText(int(x_main), int(y_main), self.font(), main_text)

        # Handle the '+' if present
        path_plus = QPainterPath()
        if plus_text:
            # Create a smaller font for the '+'
            smaller_font = QFont(self.font())
            smaller_font.setPointSize(int(smaller_font.pointSize() * 0.7))
            plus_metrics = QFontMetrics(smaller_font)

            # Position the '+' relative to the main text
            # Calculate the right edge of the main text
            main_text_right_edge = x_main + metrics.width(main_text)
            # Position '+' slightly to the right of the main text's right edge
            x_plus = main_text_right_edge - plus_metrics.width(plus_text) / 2 + 3 # Adjust as needed
            y_plus = y_main - metrics.height() * 0.3 # Keep relative y position
            
            path_plus.addText(int(x_plus), int(y_plus), smaller_font, plus_text)

        # --- GRADIENT FLIPPED LOGIC ---
        
        # 1. Draw main text (ONLY IF PATH IS NOT EMPTY)
        if not path_main.isEmpty():
            # 1a. Draw outline for main text
            pen_main = QPen(self._outline_color, self._outline_width)
            pen_main.setJoinStyle(Qt.RoundJoin)
            painter.setPen(pen_main)
            painter.setBrush(Qt.NoBrush)
            painter.drawPath(path_main)

            # 1b. Draw main text fill
            painter.setPen(Qt.NoPen)
            use_gradient = False
            if self._text_gradient_colors:
                try:
                    text_rect = path_main.boundingRect()
                    # Added check for valid rect
                    if text_rect.isValid() and text_rect.height() > 0:
                        gradient = QLinearGradient(text_rect.topLeft(), text_rect.bottomLeft()) # Vertical
                        # --- GRADIENT FLIPPED ---
                        gradient.setColorAt(0, self._text_gradient_colors[1]) # bottom color (now at top)
                        gradient.setColorAt(1, self._text_gradient_colors[0]) # top color (now at bottom)
                        # --- END FLIP ---
                        painter.setBrush(gradient)
                        use_gradient = True
                except Exception as e:
                    logging.warning(f"Failed to create gradient for main text: {e}")
                    use_gradient = False
            
            if not use_gradient:
                painter.setBrush(self._text_color)
                
            painter.drawPath(path_main)

        # 2. Draw plus text (ONLY IF PATH IS NOT EMPTY)
        if not path_plus.isEmpty():
            # 2a. Draw outline for plus text
            pen_plus = QPen(self._outline_color, self._outline_width)
            pen_plus.setJoinStyle(Qt.RoundJoin)
            painter.setPen(pen_plus)
            painter.setBrush(Qt.NoBrush)
            painter.drawPath(path_plus)

            # 2b. Draw plus text fill
            painter.setPen(Qt.NoPen)
            use_gradient_plus = False
            if self._text_gradient_colors:
                try:
                    plus_rect = path_plus.boundingRect() 
                    # Added check for valid rect
                    if plus_rect.isValid() and plus_rect.height() > 0: 
                        gradient_plus = QLinearGradient(plus_rect.topLeft(), plus_rect.bottomLeft())
                        # --- GRADIENT FLIPPED ---
                        gradient_plus.setColorAt(0, self._text_gradient_colors[1]) # bottom color (now at top)
                        gradient_plus.setColorAt(1, self._text_gradient_colors[0]) # top color (now at bottom)
                        # --- END FLIP ---
                        painter.setBrush(gradient_plus)
                        use_gradient_plus = True
                except Exception as e:
                    logging.warning(f"Failed to create gradient for plus text: {e}")
                    use_gradient_plus = False

            if not use_gradient_plus:
                painter.setBrush(self._text_color)
                
            painter.drawPath(path_plus)

        painter.end()


# --- Path Configuration ---
# The absolute path to the project's root directory.
# This is used to construct absolute paths to other directories in the project.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# --- Umamusume Themed Colors ---
UMA_LIGHT_BG = "#FEFEFE"  # Very light grey (from dialog QGroupBox)
UMA_MEDIUM_BG = "#FFFFFF" # White (from dialog QDialog)
UMA_DARK_BG = "#71d71c"   # Green accent (from dialog QGroupBox::title)
UMA_ACCENT_PINK = "#FF80AB" # Vibrant pink
UMA_ACCENT_BLUE = "#82B1FF" # Sky blue
UMA_TEXT_DARK = "#8C4410" # Dark brown-ish grey
UMA_TEXT_LIGHT = "#FFFFFF" # White

# --- Qt Style Sheet (QSS) for Umamusume Theme ---
QSS = f"""
QMainWindow {{
    font-family: 'Segoe UI';
    color: {UMA_TEXT_DARK};
}}

QDockWidget {{
    background-color: {UMA_MEDIUM_BG};
    border: 1px solid {UMA_DARK_BG};
    titlebar-close-icon: url(close.png); /* Placeholder for custom icon */
}}

QDockWidget::title {{
    background: {UMA_DARK_BG};
    padding-left: 5px;
}}

QTabWidget::pane {{ /* The tab widget frame */
    border: 1px solid {UMA_DARK_BG};
    background-color: {UMA_LIGHT_BG};
}}

QTabWidget::tab-bar {{
    left: 5px; /* move to the right by 5px */
}}

QTabBar::tab {{
    background: {UMA_MEDIUM_BG};
    border: 1px solid {UMA_DARK_BG};
    border-bottom-color: {UMA_DARK_BG}; /* same as pane color */
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
    min-width: 8ex;
    padding: 5px;
    color: {UMA_TEXT_DARK};
}}

QTabBar::tab:selected, QTabBar::tab:hover {{
    background: {UMA_ACCENT_PINK};
    color: {UMA_TEXT_LIGHT};
}}

QTabBar::tab:selected {{
    border-color: {UMA_ACCENT_PINK};
    border-bottom-color: {UMA_ACCENT_PINK}; /* same as pane color */
}}

QTableWidget {{
    background-color: {UMA_LIGHT_BG};
    alternate-background-color: {UMA_MEDIUM_BG};
    gridline-color: {UMA_DARK_BG};
    color: {UMA_TEXT_DARK};
    selection-background-color: {UMA_ACCENT_BLUE};
}}

QHeaderView::section {{
    background-color: {UMA_DARK_BG};
    color: {UMA_TEXT_LIGHT};
    padding: 4px;
    border: 1px solid {UMA_DARK_BG};
}}

QLabel {{
    color: {UMA_TEXT_DARK};
}}

QComboBox, QLineEdit, QPushButton {{
    background-color: {UMA_TEXT_LIGHT};
    border: 1px solid {UMA_DARK_BG};
    padding: 3px;
    color: {UMA_TEXT_DARK};
}}

QComboBox {{
    padding-right: 18px; 
}}

QComboBox::drop-down {{
    subcontrol-origin: padding; /* Position relative to padding */
    subcontrol-position: top right;
    width: 18px;

    /* Use the light-grey from scrollbar track as the button background */
    background: #f0f0f0; 
    
    /* Remove the main border from this sub-control */
    border: none;
}}

/* Style the hover state to match scrollbar interaction */
QComboBox::drop-down:hover {{
    background: #e0e0e0; /* Slightly darker */
}}

/* Style the arrow itself */
QComboBox::down-arrow {{
    /* This is a standard QSS "border trick" to draw a triangle */
    width: 0; 
    height: 0; 
    border-style: solid;
    
    /* Make the arrow 5px high */
    border-width: 5px; 

    /* * Set top color to the dark-grey scroll handle color (#c0c0c0).
     * Set other 3 sides to transparent.
     * This creates a 5px triangle pointing down.
    */
    border-color: transparent #c0c0c0 #c0c0c0 transparent;

    margin-left:4px;
    margin-top:15px;
}}

QCheckBox {{
    background-color: {UMA_TEXT_LIGHT};
    padding: 3px;
    color: {UMA_TEXT_DARK};
}}

QPushButton {{
    background-color: {UMA_ACCENT_BLUE};
    color: {UMA_TEXT_LIGHT};
    border-radius: 5px;
    padding: 5px 10px;
}}

QPushButton:hover {{
    background-color: {UMA_ACCENT_PINK};
}}

QSlider::groove:horizontal {{
    border: 1px solid {UMA_DARK_BG};
    height: 8px; /* the groove height */
    background: {UMA_MEDIUM_BG};
    margin: 2px 0;
    border-radius: 4px;
}}

QSlider::handle:horizontal {{
    background: {UMA_ACCENT_PINK};
    border: 1px solid {UMA_DARK_BG};
    width: 18px;
    margin: -5px 0; /* handle is 16px wide, so -2 to make it centered */
    border-radius: 9px;
}}

QScrollBar:vertical {{
    border: none;
    background: #f0f0f0;
    width: 6px;
    margin: 0px 0px 0px 0px;
    padding-top: 2px;
    padding-bottom: 2px;
}}

QScrollBar::handle:vertical {{
    background: #c0c0c0;
    min-height: 20px;
    border-radius: 5px;
}}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    border: none;
    background: none;
}}

QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {{
    background: none;
}}

"""

QSS_DETAIL_DIALOG = f"""
QMainWindow {{
    font-family: 'Segoe UI';
    color: {UMA_TEXT_DARK};
}}

QDialog {{
    background-color: white;
}}

QGroupBox {{
    background-color: #FEFEFE;
    border: 1px solid {UMA_DARK_BG};
    border-radius: 5px;
    margin-top: 1ex; /* leave space at the top for the title */
    font-weight: bold;
    color: {UMA_TEXT_DARK};
}}

QGroupBox::title {{
    subcontrol-origin: margin;
    subcontrol-position: top center; /* position at the top center */
    padding: 0 3px;
    background-color: #71d71c;
    color: {UMA_TEXT_LIGHT};
    border-radius: 3px;
}}

QLabel {{
    color: {UMA_TEXT_DARK};
}}

QPushButton {{
    background-color: {UMA_ACCENT_BLUE};
    color: {UMA_TEXT_LIGHT};
    border-radius: 5px;
    padding: 5px 10px;
}}

QPushButton:hover {{
    background-color: {UMA_ACCENT_PINK};
}}

QSlider::groove:horizontal {{
    border: 1px solid {UMA_ACCENT_BLUE};
    height: 8px; /* the groove height */
    background: {UMA_ACCENT_BLUE};
    margin: 2px 0;
    border-radius: 4px;
}}

QSlider::handle:horizontal {{
    background: {UMA_ACCENT_PINK};
    border: 1px solid {UMA_ACCENT_BLUE};
    width: 18px;
    margin: -5px 0; /* handle is 16px wide, so -2 to make it centered */
    border-radius: 9px;
}}
"""

class RichTextDelegate(QStyledItemDelegate):
    def paint(self, painter, option, index):
        painter.save()
        
        self.initStyleOption(option, index)
        style = option.widget.style()
        style.drawPrimitive(QStyle.PE_PanelItemViewItem, option, painter, option.widget)

        text = index.data(Qt.DisplayRole)
        if text and ('<b>' in text):
            doc = QTextDocument()
            doc.setDefaultFont(option.font) # Set the font of the QTextDocument
            doc.setHtml(text)
            option.text = ""
            painter.translate(option.rect.topLeft())
            doc.drawContents(painter)
        else:
            super().paint(painter, option, index)
        
        painter.restore()

class UmaAnalyzerPyQt(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Umamusume: Pretty Derby - Runner Analyzer")
        self.setGeometry(100, 100, 1800, 1000)

        self.data = self.load_data()
        self.spark_info = self.load_spark_designations()
        self.skill_types = self.load_skill_types() # ADDED
        self.racers = self.load_racers()
        self.open_dialogs = []

        if self.data is None or self.spark_info is None or self.racers is None or self.skill_types is None:
            sys.exit(1)

        self.init_ui()
        self.apply_filters()

    def load_data(self):
        file_path = os.path.join(BASE_DIR, 'data', 'all_runners.csv')
        if not os.path.exists(file_path): return None
        df = pd.read_csv(file_path)
        df['sparks'] = df['sparks'].apply(json.loads)
        stat_cols = ['speed', 'stamina', 'power', 'guts', 'wit', 'score']
        for col in stat_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        return df

    def load_spark_designations(self):
        file_path = os.path.join(BASE_DIR, 'data', 'game_data', 'sparks.json')
        if not os.path.exists(file_path): return None
        with open(file_path, 'r', encoding='utf-8') as f: return json.load(f)

    def load_skill_types(self):
        file_path = os.path.join(BASE_DIR, 'data', 'game_data', 'skill_types.json')
        if not os.path.exists(file_path):
            logging.error(f"Skill types file not found at: {file_path}")
            return None
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logging.error(f"Failed to load or parse skill_types.json: {e}")
            return None

    def load_racers(self):
        if self.data is None:
            return [''] # Return empty list if data loading failed
        
        # Get unique names from the 'name' column of the dataframe
        unique_names = sorted(self.data['name'].unique())
        
        # Return the list with an empty string at the beginning for the "all" option
        return [''] + unique_names

    def _get_taskbar_height(self):
        """Get the taskbar height to avoid spawning the window underneath it."""
        # This is a Windows-specific implementation
        if os.name == 'nt':
            try:
                # Get the handle of the taskbar
                taskbar_handle = ctypes.windll.user32.FindWindowW("Shell_TrayWnd", None)
                if not taskbar_handle:
                    return 0

                # Get the rectangle of the taskbar
                rect = ctypes.wintypes.RECT()
                if not ctypes.windll.user32.GetWindowRect(taskbar_handle, ctypes.byref(rect)):
                    return 0

                # The taskbar can be on any side of the screen
                taskbar_height = rect.bottom - rect.top
                taskbar_width = rect.right - rect.left

                # We only care about the height if the taskbar is at the bottom
                # A more robust solution would check all sides
                screen_width = ctypes.windll.user32.GetSystemMetrics(0)
                if taskbar_width == screen_width:
                    return taskbar_height
                else: # Taskbar is on the side
                    return 0

            except Exception as e:
                logging.error(f"Exception while getting taskbar height: {e}")
                return 0 # Return a default value in case of error
        return 0 # Not on Windows

    def _remove_dialog_from_list(self, dialog_to_remove):
        try:
            self.open_dialogs.remove(dialog_to_remove)
        except ValueError:
            pass


    def show_runner_details(self, row, column):
        # Get the taskbar position to ensure the dialog doesn't spawn under it
        try:
            taskbar_height = self._get_taskbar_height()
        except Exception as e:
            logging.error(f"Could not get taskbar height: {e}")
            taskbar_height = 0

        table = self.tables["Stats Summary"]

        # Find the column index for "Entry Id" dynamically
        entry_id_col_index = -1
        for i in range(table.columnCount()):
            header = table.horizontalHeaderItem(i)
            if header and header.text().lower() == "entry id":
                entry_id_col_index = i
                break

        if entry_id_col_index == -1:
            print("⚠️ Could not find 'Entry Id' column.")
            return

        entry_id_item = table.item(row, entry_id_col_index)
        if not entry_id_item:
            print("⚠️ No item found at clicked cell for entry_id.")
            return

        entry_id = int(entry_id_item.text())

        # Find the runner in the data
        selected_runner_df = self.data[self.data['entry_id'] == entry_id]
        if selected_runner_df.empty:
            print(f"⚠️ Runner not found with entry_id: {entry_id}")
            return

        runner_data = selected_runner_df.iloc[0].to_dict()
        
        # Pass the available geometry to the dialog
        dialog = UmaDetailDialog(runner_data, self.spark_info, self.skill_types, self)
        self.open_dialogs.append(dialog)
        dialog.finished.connect(lambda: self._remove_dialog_from_list(dialog))
        
        # --- Center the dialog on the screen, avoiding the taskbar ---
        screen_geometry = QApplication.desktop().availableGeometry()
        
        # Adjust for taskbar if height was fetched
        screen_geometry.setHeight(screen_geometry.height() - taskbar_height)

        dialog_width = 600 # Set your dialog's width
        dialog_height = 900 # Set your dialog's height
        
        # Center calculation
        x = screen_geometry.x() + (screen_geometry.width() - dialog_width) / 2
        y = screen_geometry.y() + (screen_geometry.height() - dialog_height) / 2
        
        dialog.setGeometry(int(x), int(y), dialog_width, dialog_height)
        dialog.show()


    def init_ui(self):
        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        self.layout = QHBoxLayout(self.central_widget)

        # Create a QGroupBox for the filters
        self.controls_groupbox = QGroupBox("Filters and Controls")
        self.controls_groupbox.setLayout(QVBoxLayout())
        self.controls_groupbox.setFixedWidth(250)
        self.layout.addWidget(self.controls_groupbox)

        self.controls_widget = QWidget()
        self.controls_widget.setMinimumWidth(200) # Set a minimum width for the controls widget
        self.controls_layout = QVBoxLayout(self.controls_widget)
        self.controls_groupbox.layout().addWidget(self.controls_widget)

        self.tabs = QTabWidget()
        self.layout.addWidget(self.tabs)

        self.tab_widgets = {}
        self.tables = {}
        tab_names = ["Stats Summary", "White Sparks", "Skills Summary", "Aptitude Summary"]
        for name in tab_names:
            tab = QWidget()
            self.tabs.addTab(tab, name)
            self.tab_widgets[name] = QVBoxLayout(tab)
            table = QTableWidget()
            table.verticalHeader().setVisible(False)
            table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
            table.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOn) # Always show vertical scrollbar
            self.tables[name] = table
            self.tab_widgets[name].addWidget(self.tables[name])
        
        self.tables["Stats Summary"].setItemDelegate(RichTextDelegate(self))
        self.tables["Stats Summary"].cellDoubleClicked.connect(self.show_runner_details)

        self.controls = {}
        self.default_controls = {}

        reset_button = QPushButton("Reset Filters")
        reset_button.clicked.connect(self.reset_filters)
        self.controls_layout.addWidget(reset_button)


        sort_by_options = ['Name', 'Score', 'Speed', 'Stamina', 'Power', 'Guts', 'Wit', 'White Spark Count']
        blue_spark_options = [''] + self.spark_info['blue']
        pink_spark_options = [''] + self.spark_info['pink']
        white_spark_options = [''] + self.spark_info['white']['race'] + self.spark_info['white']['skill']

        self.add_control('runner_filter', 'Runner', QComboBox(), self.racers, '')
        self.add_control('sort_by', 'Sort By', QComboBox(), sort_by_options, 'Name')
        self.add_control('sort_dir', 'Sort Direction', QComboBox(), ['ASC', 'DESC'], 'ASC')
        for stat in ['speed', 'stamina', 'power', 'guts', 'wit']:
            self.add_control(stat, f"Min {stat.title()}", QSlider(Qt.Horizontal), default_value=0)
        
        line = QFrame()
        line.setFrameShape(QFrame.HLine)
        line.setFrameShadow(QFrame.Sunken)
        self.controls_layout.addWidget(line)

        self.add_control('filter_rep', 'Representative Sparks Only', QCheckBox())
        self.add_control('filter_blue', 'Blue Spark Type', QComboBox(), blue_spark_options, '')
        self.add_control('min_blue', 'Min Blue Spark Count', QComboBox(), [''] + [str(i) for i in range(1, 10)], '')
        self.add_control('filter_pink', 'Pink Spark Type', QComboBox(), pink_spark_options, '')
        self.add_control('min_pink', 'Min Pink Spark Count', QComboBox(), [''] + [str(i) for i in range(1, 10)], '')
        self.add_control('filter_white', 'White Spark Type', QComboBox(), white_spark_options, '')
        self.add_control('min_white', 'Min White Spark Count', QComboBox(), [''] + [str(i) for i in range(1, 10)], '')
        self.controls_layout.setSpacing(5)
        
        self.controls_layout.addStretch(0)

    def add_control(self, name, label, widget, options=None, default_value=None):
        self.controls_layout.addWidget(QLabel(label))
        self.controls[name] = widget
        self.default_controls[name] = default_value
        
        if isinstance(widget, QComboBox) and options: widget.addItems(options)
        
        if default_value is not None:
            if isinstance(widget, QComboBox): widget.setCurrentText(str(default_value))
            elif isinstance(widget, QSlider): widget.setValue(default_value)
            elif isinstance(widget, QCheckBox): widget.setChecked(default_value)

        if isinstance(widget, QSlider):
            widget.setRange(0, 1200)
            slider_layout = QHBoxLayout()
            num_input = QLineEdit(str(widget.value()))
            num_input.setFixedWidth(50)
            slider_layout.addWidget(widget)
            slider_layout.addWidget(num_input)
            self.controls_layout.addLayout(slider_layout)
            widget.valueChanged.connect(lambda v, le=num_input: le.setText(str(v)))
            num_input.textChanged.connect(lambda t, s=widget: s.setValue(int(t) if t.isdigit() else 0))
            widget.valueChanged.connect(self.apply_filters)
        else:
            self.controls_layout.addWidget(widget)

        if isinstance(widget, QComboBox): widget.currentIndexChanged.connect(self.apply_filters)
        elif isinstance(widget, QLineEdit): widget.textChanged.connect(self.apply_filters)
        elif isinstance(widget, QCheckBox): widget.stateChanged.connect(self.toggle_rep_filter)

    def reset_filters(self):
        for name, widget in self.controls.items():
            default_value = self.default_controls[name]
            if isinstance(widget, QComboBox): widget.setCurrentText(str(default_value) if default_value is not None else '')
            elif isinstance(widget, QSlider): widget.setValue(default_value if default_value is not None else 0)
            elif isinstance(widget, QCheckBox): widget.setChecked(default_value if default_value is not None else False)
        self.apply_filters()

    def toggle_rep_filter(self):
        is_rep = self.controls['filter_rep'].isChecked()
        new_range = [''] + [str(i) for i in range(1, 4)] if is_rep else [''] + [str(i) for i in range(1, 10)]
        for key in ['min_blue', 'min_pink', 'min_white']:
            current_val = self.controls[key].currentText()
            self.controls[key].clear(); self.controls[key].addItems(new_range)
            if is_rep and current_val and int(current_val) > 3:
                self.controls[key].setCurrentText('3')
            else:
                self.controls[key].setCurrentText(current_val)
        self.apply_filters()

    def apply_filters(self):
        controls = {key: w.currentText() if isinstance(w, QComboBox) else w.text() if isinstance(w, QLineEdit) else w.isChecked() if isinstance(w, QCheckBox) else w.value() for key, w in self.controls.items()}
        
        filtered_df = self.filter_data(self.data.copy(), controls)
        stats_summary_df = self.generate_stats_summary_columns(filtered_df.copy(), controls)
        self.update_table(self.tables["Stats Summary"], stats_summary_df, controls)

    def filter_data(self, df, controls):
        runner_filter = controls.get('runner_filter')
        if runner_filter:
            df = df[df['name'] == runner_filter]

        use_rep_only = controls.get('filter_rep', False)
        
        for stat in ['speed', 'stamina', 'power', 'guts', 'wit']:
            min_val = controls.get(stat, 0)
            if min_val > 0:
                df = df[df[stat] >= min_val]

        rows_to_drop = []
        for index, row in df.iterrows():
            sparks = row['sparks']
            
            def check_spark_cond(color, filter_type, min_count_str):
                min_count = int(min_count_str) if min_count_str and min_count_str.isdigit() else 0
                if not filter_type and not min_count > 0: return True
                
                spark_list = [s for s in sparks if s['color'] == color]
                if use_rep_only: spark_list = [s for s in spark_list if s['type'] == 'representative']
                
                if filter_type:
                    spark_sum = sum(int(s['count']) for s in spark_list if s['spark_name'] == filter_type)
                    if min_count > 0:
                        return spark_sum >= min_count
                    else:
                        return spark_sum > 0
                elif min_count > 0:
                    spark_counts = {}
                    for s in spark_list:
                        spark_counts[s['spark_name']] = spark_counts.get(s['spark_name'], 0) + int(s['count'])
                    return any(total >= min_count for total in spark_counts.values())
                return True

            if not check_spark_cond('blue', controls.get('filter_blue'), controls.get('min_blue')):
                rows_to_drop.append(index)
                continue
            if not check_spark_cond('pink', controls.get('filter_pink'), controls.get('min_pink')):
                rows_to_drop.append(index)
                continue
            if not check_spark_cond('white', controls.get('filter_white'), controls.get('min_white')):
                rows_to_drop.append(index)
                continue

        return df.drop(rows_to_drop)

    def generate_stats_summary_columns(self, df, controls):
        df['Blue Sparks'] = df['sparks'].apply(lambda s: self.combine_sparks(s, 'blue'))
        df['Pink Sparks'] = df['sparks'].apply(lambda s: self.combine_sparks(s, 'pink'))
        df['White Spark Count'] = df['sparks'].apply(lambda s: f"{sum(1 for sp in s if sp['color'] == 'white')}({sum(1 for sp in s if sp['color'] == 'white' and sp['type'] == 'representative')})")

        sort_by = controls.get('sort_by', 'Name').lower()
        sort_dir_str = controls.get('sort_dir', 'ASC')
        ascending = sort_dir_str == 'ASC'

        if sort_by == 'white spark count':
            use_rep = controls.get('filter_rep', False)
            def get_sort_key(count_str):
                match = re.match(r'(\d+)\((\d+)\)', count_str)
                if match:
                    total, rep = map(int, match.groups())
                    return rep if use_rep else total
                return 0
            df['sort_key'] = df['White Spark Count'].apply(get_sort_key)
            df = df.sort_values(by='sort_key', ascending=ascending).drop(columns=['sort_key'])
        elif sort_by in df.columns:
            df = df.sort_values(by=sort_by, ascending=ascending)

        return df[['entry_id', 'name', 'score', 'speed', 'stamina', 'power', 'guts', 'wit', 'Blue Sparks', 'Pink Sparks', 'White Spark Count']]

    def combine_sparks(self, sparks_list, color):
        if not sparks_list: return ""
        source_sparks = [s for s in sparks_list if s['color'] == color]
        total_map = {}
        for s in source_sparks:
            total_map[s['spark_name']] = total_map.get(s['spark_name'], 0) + int(s['count'])
        rep_map = {}
        for s in source_sparks:
            if s['type'] == 'representative':
                rep_map[s['spark_name']] = rep_map.get(s['spark_name'], 0) + int(s['count'])
        order = self.spark_info.get(color, [])
        sorted_items = sorted(total_map.items(), key=lambda item: order.index(item[0]) if item[0] in order else float('inf'))
        return ", ".join([f"{name} {total}({rep_map.get(name, 0)})" if name in rep_map else f"{name} {total}" for name, total in sorted_items])

    def get_highlighted_spark_html(self, cell_value, color, controls):
        filter_type = controls.get(f'filter_{color}')
        min_count_str = controls.get(f'min_{color}')
        min_count = int(min_count_str) if min_count_str and min_count_str.isdigit() else 0

        if not filter_type and not min_count > 0:
            return cell_value

        parts = cell_value.split(', ')
        highlighted_parts = []
        for part in parts:
            should_bold = False
            if filter_type and part.startswith(filter_type):
                should_bold = True
            elif not filter_type and min_count > 0:
                match = re.search(r' (\d+)', part)
                if match and int(match.group(1)) >= min_count:
                    should_bold = True
            
            if should_bold:
                highlighted_parts.append(f'<b>{part}</b>')
            else:
                highlighted_parts.append(part)
        return ", ".join(highlighted_parts)

    def get_grade_for_stat(self, value):
        if value >= 1150: return 'SS+'
        elif value >= 1100: return 'SS'
        elif value >= 1050: return 'S+'
        elif value >= 1000: return 'S'
        elif value >= 900: return 'A+'
        elif value >= 800: return 'A'
        elif value >= 700: return 'B+'
        elif value >= 600: return 'B'
        elif value >= 500: return 'C+'
        elif value >= 400: return 'C'
        elif value >= 350: return 'D+'
        elif value >= 300: return 'D'
        elif value >= 250: return 'E+'
        elif value >= 200: return 'E'
        elif value >= 150: return 'F+'
        elif value >= 100: return 'F'
        else: return 'G'

    def get_aptitude_grade_color(self, grade):
        grade_colors = {
            'SS': '#f0bd1a',
            'S': '#f0bd1a',
            'A': '#f48337',
            'B': '#e56487',
            'C': '#61c340',
            'D': '#49ace2',
            'E': '#d477f2',
            'F': '#766ad6',
            'G': '#b3b2b3'
        }        
        base_grade = grade.split('<')[0].rstrip('+')
        return grade_colors.get(base_grade, '#424242')

    def update_table(self, table, df, controls):
        table.clear()
        table.setRowCount(len(df))
        table.setColumnCount(len(df.columns))
        table.setHorizontalHeaderLabels([c.replace('_', ' ').title() for c in df.columns])

        if 'entry_id' in df.columns:
            entry_id_idx = df.columns.get_loc('entry_id')
            table.setColumnHidden(entry_id_idx, True)

        for i, (index, row) in enumerate(df.iterrows()):
            for j, col in enumerate(df.columns):
                cell_value = row[col]
                if col == 'score':
                    item = QTableWidgetItem(f"{cell_value:,}")
                else:
                    item = QTableWidgetItem(str(cell_value))
                
                item.setTextAlignment(Qt.AlignCenter)

                if col.lower() in ['speed', 'stamina', 'power', 'guts', 'wit']:
                    grade = self.get_grade_for_stat(cell_value)
                    color_hex = self.get_aptitude_grade_color(grade)
                    
                    if color_hex:
                        color = QColor(color_hex).lighter(150)
                        item.setBackground(color)
                
                if col in ['Blue Sparks', 'Pink Sparks']:
                    item.setTextAlignment(Qt.AlignLeft | Qt.AlignVCenter)
                    html = self.get_highlighted_spark_html(str(cell_value), col.split()[0].lower(), controls)
                    item.setText(html)
                
                table.setItem(i, j, item)
        
        for i, col in enumerate(df.columns):
            if col.lower() in ['score', 'speed', 'stamina', 'power', 'guts', 'wit']:
                table.horizontalHeader().setSectionResizeMode(i, QHeaderView.Fixed)
                table.setColumnWidth(i, 100) # Half the original 80, adjusted for compactness
            elif "Sparks" in col:
                table.horizontalHeader().setSectionResizeMode(i, QHeaderView.Interactive)
                table.setColumnWidth(i, 300) # Adjusted for compactness
            elif "White Spark Count" in col:
                table.horizontalHeader().setSectionResizeMode(i, QHeaderView.Interactive)
                table.setColumnWidth(i, 180) # Adjusted for compactness
            elif "Name" in col:
                table.horizontalHeader().setSectionResizeMode(i, QHeaderView.Interactive)
                table.setColumnWidth(i, 150) # Adjusted for compactness
            else:
                table.horizontalHeader().setSectionResizeMode(i, QHeaderView.Stretch) # Default for others

class UmaDetailDialog(QDialog):
    # UPDATED signature
    def __init__(self, runner_data, spark_info, skill_types, parent=None):
        super().__init__(parent)
        self.setWindowTitle(f"Umamusume Details: {runner_data['name']}")
        self.setGeometry(200, 200, 600, 900)
        self.runner_data = runner_data
        self.spark_info = spark_info
        self.skill_types = skill_types if skill_types else {}
        self.setStyleSheet(QSS_DETAIL_DIALOG)
        self.init_ui()

    def get_grade_for_stat(self, value):
        if value >= 1150: return 'SS+'
        elif value >= 1100: return 'SS'
        elif value >= 1050: return 'S+'
        elif value >= 1000: return 'S'
        elif value >= 900: return 'A+'
        elif value >= 800: return 'A'
        elif value >= 700: return 'B+'
        elif value >= 600: return 'B'
        elif value >= 500: return 'C+'
        elif value >= 400: return 'C'
        elif value >= 350: return 'D+'
        elif value >= 300: return 'D'
        elif value >= 250: return 'E+'
        elif value >= 200: return 'E'
        elif value >= 150: return 'F+'
        elif value >= 100: return 'F'
        else: return 'G'

    def get_stat_grade_text_color(self, grade):
        return self.get_aptitude_grade_color(grade)

    def get_aptitude_grade_color(self, grade):
        grade_colors = {
            'SS': '#f0bd1a',
            'S': '#f0bd1a',
            'A': '#f48337',
            'B': '#e56487',
            'C': '#61c340',
            'D': '#49ace2',
            'E': '#d477f2',
            'F': '#766ad6',
            'G': '#b3b2b3'
        }        
        base_grade = grade.split('<')[0].rstrip('+')
        return grade_colors.get(base_grade, '#424242')        

    def _format_skill_name_with_symbols(self, skill_name):
        # Regex to find the specific symbols
        # The symbols are: U+25CE (Circled White Bullet), U+25CB (White Circle), U+00D7 (Multiplication Sign)
        # Using a non-greedy match for the skill name part 
        formatted_name = re.sub(r'(◎|○|×)', r'<span style="font-size: 16pt; font-family: \'Segoe UI Symbol\';">\1</span>', skill_name)
        return formatted_name

    def _mix_colors(self, color1, color2, ratio=0.5):
        # Ensure colors are QColor objects
        qc1 = QColor(color1)
        qc2 = QColor(color2)

        r = int(qc1.red() * (1 - ratio) + qc2.red() * ratio)
        g = int(qc1.green() * (1 - ratio) + qc2.green() * ratio)
        b = int(qc1.blue() * (1 - ratio) + qc2.blue() * ratio)
        return QColor(r, g, b)

    def init_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(15)

        # --- Header Section ---
        header_widget = QWidget()
        header_layout = QHBoxLayout(header_widget)
        header_layout.setContentsMargins(20, 0, 0, 0)
        header_layout.setSpacing(15)

        # Left side: Image and Score
        left_header_layout = QVBoxLayout()
        left_header_layout.setSpacing(5)
        left_header_layout.setAlignment(Qt.AlignCenter)

        char_image_label = QLabel()
        char_image_label.setFixedSize(100, 100)

        # --- Load Character Image ---
        image_name = self.runner_data['name'].replace(' ', '_')
        image_path = None
        for ext in ['png', 'jpg', 'jpeg']:
            potential_path = os.path.join(BASE_DIR, 'assets', 'profile_images', f'{image_name}.{ext}')
            if os.path.exists(potential_path):
                image_path = potential_path
                break

        if image_path:
            # The label is 100x100 with a 4px border. The area for the image is 94x94.
            image_size = 94
            label_size = 100

            # 1. Load original pixmap
            source_pixmap = QPixmap(image_path)

            # 2. Calculate zoom and crop dimensions
            zoom_factor = 1.4 # Increased zoom from 1.4
            
            # Scale source to be zoom_factor bigger than the target image_size
            scaled_size = source_pixmap.size()
            scaled_size.scale(int(image_size * zoom_factor), int(image_size * zoom_factor), Qt.KeepAspectRatioByExpanding)
            scaled_pixmap = source_pixmap.scaled(scaled_size, Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation)

            # Define the crop rectangle (94x94) from the zoomed pixmap
            crop_x = (scaled_pixmap.width() - image_size) / 2
            crop_y = 0
            crop_rect = QRect(int(crop_x), int(crop_y), image_size, image_size)
            cropped_pixmap = scaled_pixmap.copy(crop_rect)

            # 3. Create a circular mask for the 94x94 image
            final_pixmap = QPixmap(image_size, image_size)
            final_pixmap.fill(Qt.transparent)

            painter = QPainter(final_pixmap)
            painter.setRenderHint(QPainter.Antialiasing)
            
            path = QPainterPath()
            path.addEllipse(0, 0, image_size, image_size)
            
            painter.setClipPath(path)
            painter.drawPixmap(0, 0, cropped_pixmap)
            painter.end()

            char_image_label.setPixmap(final_pixmap)
            char_image_label.setAlignment(Qt.AlignCenter) # Center the smaller pixmap
            char_image_label.setStyleSheet("background-color: transparent; border: 4px solid #AAAAAA; border-radius: 50px;")
        else:
            char_image_label.setStyleSheet("background-color: #E0E0E0; border-radius: 50px; border: 4px solid #AAAAAA;")
        
        left_header_layout.addWidget(char_image_label)

        score_label = QLabel(f"<b>{self.runner_data['score']:,}</b>")
        score_label.setAlignment(Qt.AlignCenter)
        score_label.setStyleSheet("font-size: 14pt; background-color: white; border: 2px solid #C0C0C0; border-radius: 8px; padding: 2px 8px;")
        left_header_layout.addWidget(score_label)
        
        header_layout.addLayout(left_header_layout)

        # Right side: Rank and Name
        right_header_layout = QVBoxLayout()
        right_header_layout.setSpacing(10)
        right_header_layout.setAlignment(Qt.AlignVCenter)

        rank_name_layout = QHBoxLayout()
        rank_name_layout.setSpacing(15)
        
        rank_badge_container = QFrame()
        rank_badge_container.setFixedSize(80, 80)
        rank_badge_layout = QVBoxLayout(rank_badge_container)
        rank_badge_layout.setContentsMargins(5,5,5,5)
        rank_badge_layout.setSpacing(0)
        rank_grade = calculateRank(int(self.runner_data['score']))
        badge_color = self.get_aptitude_grade_color(rank_grade)
        
        # --- NEW DIAGONAL GRADIENT LOGIC ---
        base_color = QColor(badge_color)
        # Brighter for top-left
        brighter_color = base_color.lighter(0).name() 
        # Darker for bottom-right
        darker_color = base_color.darker(6).name()   

        # x1:0, y1:0 is top-left
        # x2:1, y2:1 is bottom-right
        gradient_style = f"""
            background-color: qlineargradient(
                x1: 0, y1: 1, x2: 1, y2: 0,
                stop: 0 {brighter_color}, 
                stop: 0.7 {base_color.name()}, 
                stop: 1 {darker_color}
            );
            border-radius: 40px;
        """
        rank_badge_container.setStyleSheet(gradient_style)

        rank_grade_label = OutlineLabel(rank_grade, outline_color=QColor(UMA_TEXT_DARK), outline_width=2, text_color=Qt.white)

        rank_grade_label = OutlineLabel(rank_grade, outline_color=QColor(UMA_TEXT_DARK), outline_width=2, text_color=Qt.white)
        rank_grade_label.setAlignment(Qt.AlignCenter)
        rank_grade_label.setStyleSheet("font-weight: bold; font-size: 28pt; background: transparent; padding: 3px;")
        rank_badge_layout.addWidget(rank_grade_label)

        rank_text_label = OutlineLabel("RANK", outline_color=QColor(UMA_TEXT_DARK), outline_width=1, text_color=Qt.white)
        rank_text_label.setAlignment(Qt.AlignCenter)
        rank_text_label.setStyleSheet("font-weight: bold; background: transparent; margin-top: -8px;")
        rank_badge_layout.addWidget(rank_text_label)
        rank_name_layout.addWidget(rank_badge_container)

        name_label = QLabel(f"<b>{self.runner_data['name']}</b>")
        name_label.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)
        name_label.setStyleSheet(f"font-size: 24pt; color: {UMA_TEXT_DARK}; font-weight: bold; padding-left: 40px; letter-spacing: 1px;")
        rank_name_layout.addWidget(name_label)
        rank_name_layout.addStretch()
        
        right_header_layout.addLayout(rank_name_layout)
        
        header_layout.addLayout(right_header_layout)
        main_layout.addWidget(header_widget)

        # --- Stats Section ---
        stats_container = QFrame()
        stats_container.setObjectName("statsContainer")
        stats_container.setStyleSheet("""
            #statsContainer {
                border: 2px solid #71d71c;
                border-radius: 12px;
            }
        """)
        stats_main_layout = QHBoxLayout(stats_container)
        stats_main_layout.setContentsMargins(0, 0, 0, 0)
        stats_main_layout.setSpacing(0)
        
        stat_names = ['speed', 'stamina', 'power', 'guts', 'wit']
        stat_icons = {
            'speed': '👟', 'stamina': '🤍', 'power': '💪🏻', 'guts': '🔥', 'wit': '🎓'
        }

        for i, stat in enumerate(stat_names):
            stat_value = self.runner_data.get(stat, 0)
            stat_grade = self.get_grade_for_stat(stat_value)

            # Create a vertical container for the whole column
            column_container = QWidget()
            column_container.setFixedWidth(120)
            column_layout = QVBoxLayout(column_container)
            column_layout.setContentsMargins(0, 0, 0, 0)
            column_layout.setSpacing(0)

            # --- FIX: Define border style here ---
            # We will apply this to the children, not the parent container
            border_style = "border-right: 2px dashed #A5D6A7;" if i < len(stat_names) - 1 else ""
            
            # --- REMOVED this block ---
            # if i < len(stat_names) - 1:
            #     column_container.setStyleSheet("border-right: 2px dashed #A5D6A7;")

            # --- Top Row (Header) ---
            header_label = OutlineLabel(f"{stat_icons.get(stat, '')} {stat.title()}", outline_color=QColor('#fefefe'), outline_width=0.5, text_color=Qt.white)
            header_label.setAlignment(Qt.AlignHCenter | Qt.AlignVCenter)
            header_radius_style = ""
            if i == 0:
                header_radius_style = "border-top-left-radius: 9px;"
            elif i == len(stat_names) - 1:
                header_radius_style = "border-top-right-radius: 9px;"
            
            # --- MODIFIED: Added border_style ---
            header_label.setStyleSheet(f"background-color: #71d71c; font-size: 14pt; {header_radius_style} padding: 3px; letter-spacing: 1px; {border_style}")
            column_layout.addWidget(header_label)

            # --- Bottom Row (Content) ---
            content_widget = QWidget()
            content_layout = QHBoxLayout(content_widget)
            content_layout.setContentsMargins(0, 5, 0, 5)
            content_layout.setSpacing(0)
            content_radius_style = ""
            if i == 0:
                content_radius_style = "border-bottom-left-radius: 9px;"
            elif i == len(stat_names) - 1:
                content_radius_style = "border-bottom-right-radius: 9px;"
            
            content_widget.setStyleSheet(f"background-color: white; {content_radius_style} {border_style}")

            grade_text_color = self.get_stat_grade_text_color(stat_grade)
            mixed_outline_color = self._mix_colors(grade_text_color, UMA_TEXT_DARK, ratio=0.7)
            
            base_qcolor = QColor(grade_text_color)
            top_color = base_qcolor.lighter(100).name()
            bottom_color = base_qcolor.darker(83).name()

            grade_label = OutlineLabel(stat_grade, outline_color=mixed_outline_color, outline_width=2, text_color=base_qcolor, force_left_align=True)
            grade_label.setTextGradient(bottom_color, top_color) # APPLY GRADIENT

            grade_label.setFixedWidth(56) # Set a fixed width for the grade label
            grade_label.setAlignment(Qt.AlignCenter)
            grade_label.setStyleSheet("font-weight: bold; font-size: 25pt; background-color: transparent; border: none; padding: 3px; letter-spacing: -4px;")
            
            value_label = QLabel(str(stat_value))
            value_label.setAlignment(Qt.AlignRight | Qt.AlignVCenter) # Align value to the right
            value_label.setStyleSheet("font-weight: bold; font-size: 17pt; letter-spacing: 1px; background-color: transparent; border: none; padding-right: 5px;") # Add some right padding

            content_layout.addWidget(grade_label)
            content_layout.addStretch(1)
            content_layout.addWidget(value_label)
            
            column_layout.addWidget(content_widget)

            # Add the whole column to the main horizontal layout
            stats_main_layout.addWidget(column_container)

        main_layout.addWidget(stats_container)

        # --- Aptitude Section ---
        aptitude_widget = QWidget()
        aptitude_layout = QGridLayout(aptitude_widget)
        aptitude_layout.setContentsMargins(9, 10, 2, 10)
        aptitude_layout.setSpacing(5)
        aptitude_layout.setVerticalSpacing(15)

        aptitude_types = ['track', 'distance', 'style']
        aptitude_details = {
            'track': ['turf', 'dirt'],
            'distance': ['sprint', 'mile', 'medium', 'long'],
            'style': ['front', 'pace', 'late', 'end']
        }

        for row_idx, apt_type in enumerate(aptitude_types):
            apt_type_label = QLabel(f"<b>{apt_type.title()}</b>")
            apt_type_label.setAlignment(Qt.AlignCenter) # Changed from AlignRight
            aptitude_layout.addWidget(apt_type_label, row_idx, 0)

            details = aptitude_details[apt_type]
            for col_idx, detail in enumerate(details):
                apt_key = f"rank_{detail}"
                apt_value = self.runner_data.get(apt_key, 'N/A').upper()

                apt_button = QWidget()
                apt_button.setFixedWidth(120) # --- ADD THIS LINE ---
                apt_button.setStyleSheet("font-weight: bold; font-size: 12pt; background-color: #FFFFFF; border: 2px solid #D0D0D0; border-radius: 10px;")
                
                apt_button_layout = QHBoxLayout(apt_button)
                apt_button_layout.setContentsMargins(3, 3, 3, 3)
                apt_button_layout.setSpacing(5)

                detail_label = OutlineLabel(detail.title(), outline_color=Qt.white, outline_width=1, text_color=QColor(UMA_TEXT_DARK))
                detail_label.setStyleSheet("border: none; font-size: 15pt;")
                detail_label.setAlignment(Qt.AlignCenter)
                apt_button_layout.addWidget(detail_label, 1)

                # apt_button_layout.addStretch(1) # Removed stretch from here

                grade_color = self.get_aptitude_grade_color(apt_value)
                mixed_outline_color = self._mix_colors(grade_color, UMA_TEXT_DARK, ratio=0.7)
                base_qcolor = QColor(grade_color)
                top_color = base_qcolor.lighter(100).name()
                bottom_color = base_qcolor.darker(83).name()

                grade_label = OutlineLabel(apt_value, outline_color=mixed_outline_color, outline_width=2, text_color=base_qcolor)
                grade_label.setTextGradient(bottom_color, top_color) # APPLY GRADIENT

                grade_label.setAlignment(Qt.AlignCenter)
                grade_label.setStyleSheet(f"font-weight: bold; font-size: 19pt; border: none; padding: 3px 12px 3px 3px; ")
                apt_button_layout.addWidget(grade_label, 0) # Add with stretch factor 0

                aptitude_layout.addWidget(apt_button, row_idx, col_idx + 1)
        
        max_cols = max(len(v) for v in aptitude_details.values())
        for i in range(1, max_cols + 1):
            aptitude_layout.setColumnStretch(i, 1)

        main_layout.addWidget(aptitude_widget)

        # --- Skills Section ---
        skills_section_widget = QWidget() # New container widget
        skills_section_layout = QVBoxLayout(skills_section_widget)
        skills_section_layout.setContentsMargins(0, 0, 0, 0)
        skills_section_layout.setSpacing(5)

        # OutlineLabel for the title
        skills_title_label = OutlineLabel("Skills", outline_color=QColor(UMA_TEXT_DARK), outline_width=1, text_color=UMA_TEXT_LIGHT)
        skills_title_label.setAlignment(Qt.AlignCenter)
        skills_title_label.setStyleSheet("font-weight: bold; font-size: 14pt; background-color: #71d71c; border-top-left-radius: 5px; border-top-right-radius: 5px; padding: 3px;")
        skills_section_layout.addWidget(skills_title_label)

        # Apply border to the main section widget
        skills_section_widget.setStyleSheet("border: 0px solid #71d71c; border-radius: 5px;")

        scroll_area = QScrollArea()
        scroll_area.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOn) # <-- THIS LINE IS ADDED
        scroll_bar = scroll_area.verticalScrollBar()
        scroll_bar.setSingleStep(5)
        scroll_area.setWidgetResizable(True)
        scroll_area.setStyleSheet("""
            QScrollArea {
                background-color: transparent;
                border: none;
            }
            QScrollArea > QWidget {
                background-color: #F5F5F5; /* Light gray background for the inner area */
                border-radius: 5px;
            }
            QScrollBar:vertical {
                border: none;
                background: #f0f0f0;
                width: 6px;
                margin: 0px 0px 0px 0px;
                padding-top: 2px;
                padding-bottom: 2px;
            }
            QScrollBar::handle:vertical {
                background: #c0c0c0;
                min-height: 20px;
                border-radius: 5px;
            }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
                border: none;
                background: none;
            }
            QScrollBar::add-page:vertical, QScrollBar::sub-page:vertical {
                background: none;
            }
        """)

        scroll_widget = QWidget()
        skills_layout = QGridLayout(scroll_widget)  # use grid layout for 2 columns
        skills_layout.setSpacing(8)
        skills_layout.setContentsMargins(15, 15, 15, 15) # Add margins to the skills layout

        skills_str = self.runner_data.get('skills', '')
        if skills_str:
            skills = [s.strip() for s in skills_str.split('|')]
            
            # Determine how many items go in the first column
            n = len(skills)
            mid = (n + 1) // 2  # ensures first column gets the extra item if odd
            
            for i, skill in enumerate(skills):
                # --- NEW LOGIC FOR ICON + TEXT ---
                
                # 1. Create container and layout
                skill_container = QWidget()
                skill_layout = QHBoxLayout(skill_container)
                skill_layout.setContentsMargins(8, 5, 10, 5) # l, t, r, b
                skill_layout.setSpacing(8)

                # 2. Get skill type and icon
                skill_type = self.skill_types.get(skill, None)
                icon_label = QLabel()
                icon_label.setFixedSize(32, 32) # Standard icon size
                icon_label.setStyleSheet("border: none; background: transparent;") # No border or bg

                if skill_type:
                    icon_path = os.path.join(BASE_DIR, 'assets', 'skill_icons', f'{skill_type}.png')
                    if os.path.exists(icon_path):
                        pixmap = QPixmap(icon_path)
                        icon_label.setPixmap(pixmap.scaled(32, 32, Qt.KeepAspectRatio, Qt.SmoothTransformation))
                    else:
                        logging.warning(f"Icon not found for skill type '{skill_type}' at {icon_path}")
                else:
                    logging.warning(f"Skill '{skill}' not found in skill_types.json")

                skill_layout.addWidget(icon_label)

                # 3. Create text label
                formatted_skill_name = self._format_skill_name_with_symbols(skill)
                skill_label = QLabel(formatted_skill_name)
                skill_label.setStyleSheet(
                    f"QLabel {{ background-color: transparent; color: {UMA_TEXT_DARK}; border: none; padding: 0; text-align: left; font-weight: bold; letter-spacing: 1px; }}"
                )
                skill_label.setTextFormat(Qt.RichText)
                skill_label.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)
                skill_label.setWordWrap(True)
                
                # --- NEW: Set FIXED height for 2 lines ---
                font_metrics = skill_label.fontMetrics()
                # Get height of two lines of text
                two_line_height = font_metrics.height() * 2 
                
                icon_height = 32 # From icon_label.setFixedSize(32, 32)
                # Content height is the taller of the icon or two lines of text
                content_height = max(icon_height, two_line_height)
                
                vertical_padding = 15 + 5 # From skill_layout.setContentsMargins(8, 5, 10, 5)
                fixed_container_height = content_height + vertical_padding
                
                # --- THIS IS THE CHANGE ---
                skill_container.setFixedHeight(int(fixed_container_height))
                # --- END CHANGE ---
                
                skill_layout.addWidget(skill_label, 1) # Add with stretch factor

                # --- 4. DYNAMICALLY STYLE CONTAINER ---
                container_style = ""
                default_border = "border: 2px solid #C0C0C0; border-radius: 10px;" # Default border
                
                # Rule 2: Rainbow (checked first as it's more specific)
                # Gradient based on uniquebox.PNG (Higher Saturation)
                if skill_type and skill_type.startswith('unique') and i == 0:
                    rainbow_bg = "qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #F9E08B, stop:0.35 #C4FFC8, stop:0.65 #B8ECFF, stop:1 #F6BFFF);"
                    rainbow_border = "border: 2px solid #C8C8C8; border-radius: 10px;" # Light border
                    container_style = f"QWidget {{ background: {rainbow_bg} {rainbow_border} }}"
                
                # Rule 1: Gold
                # Gradient based on goldbox.PNG (Higher Saturation)
                elif skill_type and skill_type.endswith('g'):
                    gold_bg = "qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #FFEA8A, stop:1 #FFC24A);"
                    gold_border = "border: 2px solid #E6A245; border-radius: 10px;"
                    container_style = f"QWidget {{ background: {gold_bg} {gold_border} }}"
                
                # Rule 3: Default
                else:
                    default_bg = "#F5F5F5;"
                    container_style = f"QWidget {{ background-color: {default_bg} {default_border} }}"

                skill_container.setStyleSheet(container_style)

                # 5. Add container to grid
                if i < mid:
                    row = i
                    col = 0
                else:
                    row = i - mid
                    col = 1
                skills_layout.addWidget(skill_container, row, col)
                # --- END OF MODIFIED LOGIC ---
        else:
            skills_layout.addWidget(QLabel("No skills listed."), 0, 0)

        # Add stretch to bottom of both columns
        skills_layout.setRowStretch((len(skills) + 1) // 2, 1)
        skills_layout.setColumnStretch(0, 1)
        skills_layout.setColumnStretch(1, 1)

        scroll_area.setWidget(scroll_widget)
        skills_section_layout.addWidget(scroll_area)
        main_layout.addWidget(skills_section_widget, 1)


def calculateRank(score):
    if score < 0:
        return "Invalid"

    ranges = [
        (0, 299, "G"),
        (300, 599, "G+"),
        (600, 899, "F"),
        (900, 1299, "F+"),
        (1300, 1799, "E"),
        (1800, 2299, "E+"),
        (2300, 2899, "D"),
        (2900, 3499, "D+"),
        (3500, 4899, "C"),
        (4900, 6499, "C+"),
        (6500, 8199, "B"),
        (8200, 9999, "B+"),
        (10000, 12099, "A"),
        (12100, 14499, "A+"),
        (14500, 15899, "S"),
        (15900, 17499, "S+"),
        (17500, 19199, "SS"),
        (19200, 19599, "SS+")
    ]

    for low, high, rank in ranges:
        if low <= score <= high:
            return rank
    return "Out of range"


if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setFont(QFont("Segoe UI", 12)) # Consider a more thematic font if available
    app.setStyleSheet(QSS_DETAIL_DIALOG + QSS) # Apply the custom QSS
    main_window = UmaAnalyzerPyQt()
    main_window.showMaximized()
    sys.exit(app.exec_())

