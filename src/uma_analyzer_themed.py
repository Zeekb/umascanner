import sys
import pandas as pd
import json
import os
import re
import logging
import ctypes

logging.basicConfig(filename='app.log', level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')

class StreamToLogger(object):
    """A helper class to redirect stdout and stderr streams to the logging module."""
    def __init__(self, logger, level):
        self.logger = logger
        self.level = level
        self.linebuf = ''

    def write(self, buf):
        """Writes buffer content to the logger."""
        for line in buf.rstrip().splitlines():
            self.logger.log(self.level, line.rstrip())

    def flush(self):
        """A placeholder flush method to mimic a file-like object."""
        pass

sys.stdout = StreamToLogger(logging.getLogger('STDOUT'), logging.INFO)
sys.stderr = StreamToLogger(logging.getLogger('STDERR'), logging.ERROR)

from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QTabWidget, QTableWidget, QTableWidgetItem, QDockWidget, QLabel,
    QComboBox, QLineEdit, QCheckBox, QSlider, QHeaderView, QPushButton,
    QStyledItemDelegate, QStyle, QFrame, QDialog, QScrollArea, QGroupBox, QGridLayout, QRadioButton, QGraphicsDropShadowEffect,
    QSizePolicy, QMessageBox # Added QSizePolicy, QMessageBox
)
from PyQt5.QtGui import QColor, QTextDocument, QFont, QPixmap, QPainter, QPainterPath, QPen, QFontMetrics, QIcon, QLinearGradient, QTextOption
from PyQt5.QtCore import Qt, QRect, QEvent, QRectF

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Make sure utils.py and styles.py are in the same directory or accessible via PYTHONPATH
try:
    # Assuming utils and styles might be in a subdirectory or project root relative to BASE_DIR
    # Adjust path if necessary, e.g., sys.path.append(os.path.join(BASE_DIR, '..'))
    from utils import calculateRank, get_grade_for_stat, get_aptitude_grade_color
    # Try importing styles relative to the script's directory first
    try:
        from styles import QSS, QSS_DETAIL_DIALOG, UMA_TEXT_DARK, UMA_TEXT_LIGHT
    except ImportError:
        # Fallback if styles.py is in the parent directory (like in the original structure)
        parent_dir = os.path.dirname(BASE_DIR)
        if parent_dir not in sys.path:
            sys.path.insert(0, parent_dir)
        from styles import QSS, QSS_DETAIL_DIALOG, UMA_TEXT_DARK, UMA_TEXT_LIGHT

except ImportError as e:
    logging.critical(f"Failed to import utils or styles: {e}. Ensure utils.py and styles.py are accessible.")
    # Show critical error immediately if possible
    app_check = QApplication.instance()
    if not app_check:
        app_check = QApplication(sys.argv) # Need an app instance for QMessageBox
    QMessageBox.critical(None, "Import Error", f"Failed to import required modules (utils/styles):\n{e}\nPlease ensure utils.py and styles.py are present and accessible.")
    sys.exit(1)


class OutlineLabel(QLabel):
    """A custom QLabel that renders text with a customizable outline and gradient fill."""
    def __init__(self, text="", parent=None, outline_color=Qt.black, outline_width=3, text_color=Qt.white, force_left_align=False):
        super().__init__(text, parent)
        self._outline_color = QColor(outline_color) if not isinstance(outline_color, QColor) else outline_color
        self._outline_width = outline_width
        self._text_color = QColor(text_color) if not isinstance(text_color, QColor) else text_color
        self._force_left_align = force_left_align
        self._text_gradient_colors = None

    def setOutlineColor(self, color):
        """Sets the color of the text outline."""
        self._outline_color = QColor(color) if not isinstance(color, QColor) else color
        self.update()

    def setOutlineWidth(self, width):
        """Sets the width of the text outline."""
        self._outline_width = width
        self.update()

    def setTextColor(self, color):
        """Sets the solid fill color of the text."""
        self._text_color = QColor(color) if not isinstance(color, QColor) else color
        self.update()

    def setTextGradient(self, color_top, color_bottom):
        """Sets a vertical gradient for the text fill."""
        self._text_gradient_colors = (QColor(color_top), QColor(color_bottom))
        self._text_color = QColor(color_top)
        self.update()

    # Reverted paintEvent to original version from user file
    def paintEvent(self, event):
        """
        Custom painting logic to draw the text outline and fill.
        This method handles complex positioning, especially for text ending in a '+',
        which is rendered smaller and superscripted.
        """
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)

        plain_text = re.sub(r'<[^>]+>', '', self.text())
        metrics = painter.fontMetrics()

        main_text = plain_text
        plus_text = ""
        if plain_text.endswith('+'):
            main_text = plain_text[:-1]
            plus_text = '+'

        # Calculate the drawing position for the main text based on alignment settings.
        if self._force_left_align:
            x_main = 5
            text_height = metrics.height()
            y_main = (self.height() - text_height) / 2 + metrics.ascent()
        else:
            main_text_rect = metrics.boundingRect(self.rect(), Qt.AlignCenter, main_text)
            x_main = main_text_rect.x()
            y_main = main_text_rect.y() + metrics.ascent()

        # Create a QPainterPath for the main text to enable advanced drawing.
        path_main = QPainterPath()
        if main_text:
            path_main.addText(int(x_main), int(y_main), self.font(), main_text)

        # If a '+' sign exists, create a separate path for it with a smaller font.
        path_plus = QPainterPath()
        if plus_text:
            smaller_font = QFont(self.font())
            smaller_font.setPointSize(int(smaller_font.pointSize() * 0.7))
            plus_metrics = QFontMetrics(smaller_font)
            main_text_right_edge = x_main + metrics.width(main_text)
            x_plus = main_text_right_edge - plus_metrics.width(plus_text) / 2 + 3
            y_plus = y_main - metrics.height() * 0.3
            path_plus.addText(int(x_plus), int(y_plus), smaller_font, plus_text)

        # Draw the main text path if it's not empty.
        if not path_main.isEmpty():
            # First, draw the outline.
            pen_main = QPen(self._outline_color, self._outline_width)
            pen_main.setJoinStyle(Qt.RoundJoin)
            painter.setPen(pen_main)
            painter.setBrush(Qt.NoBrush)
            painter.drawPath(path_main)

            # Second, draw the fill (either solid or gradient).
            painter.setPen(Qt.NoPen)
            use_gradient = False
            if self._text_gradient_colors:
                try:
                    text_rect = path_main.boundingRect()
                    if text_rect.isValid() and text_rect.height() > 0:
                        # Reverted gradient direction
                        gradient = QLinearGradient(text_rect.topRight(), text_rect.bottomRight())
                        gradient.setColorAt(0, self._text_gradient_colors[1])
                        gradient.setColorAt(1, self._text_gradient_colors[0])
                        painter.setBrush(gradient)
                        use_gradient = True
                except Exception as e:
                    logging.warning(f"Failed to create gradient for main text: {e}")
                    use_gradient = False

            if not use_gradient:
                painter.setBrush(self._text_color)
            painter.drawPath(path_main)

        # Draw the plus sign path if it's not empty.
        if not path_plus.isEmpty():
            # First, draw the outline for the plus sign.
            pen_plus = QPen(self._outline_color, self._outline_width)
            pen_plus.setJoinStyle(Qt.RoundJoin)
            painter.setPen(pen_plus)
            painter.setBrush(Qt.NoBrush)
            painter.drawPath(path_plus)

            # Second, draw the fill for the plus sign.
            painter.setPen(Qt.NoPen)
            use_gradient_plus = False
            if self._text_gradient_colors:
                try:
                    plus_rect = path_plus.boundingRect()
                    if plus_rect.isValid() and plus_rect.height() > 0:
                         # Reverted gradient direction
                        gradient_plus = QLinearGradient(plus_rect.topLeft(), plus_rect.bottomLeft())
                        gradient_plus.setColorAt(0, self._text_gradient_colors[1])
                        gradient_plus.setColorAt(1, self._text_gradient_colors[0])
                        painter.setBrush(gradient_plus)
                        use_gradient_plus = True
                except Exception as e:
                    logging.warning(f"Failed to create gradient for plus text: {e}")
                    use_gradient_plus = False

            if not use_gradient_plus:
                painter.setBrush(self._text_color)
            painter.drawPath(path_plus)

        # Removed painter.end() as it's not needed with 'self'


# Reverted RichTextDelegate to original version
class RichTextDelegate(QStyledItemDelegate):
    """A delegate for QTableWidget to render HTML content within cells."""
    def paint(self, painter, option, index):
        """Renders the cell content, parsing HTML if present."""
        painter.save()

        self.initStyleOption(option, index)
        style = option.widget.style()
        style.drawPrimitive(QStyle.PE_PanelItemViewItem, option, painter, option.widget)

        text = index.data(Qt.DisplayRole)
        # If the text contains HTML tags, use QTextDocument to render it.
        if text and ('<b>' in text): # Original simple check
            doc = QTextDocument()
            doc.setDefaultFont(option.font)
            doc.setHtml(text)
            option.text = "" # Prevent default text rendering
            painter.translate(option.rect.topLeft())
            doc.drawContents(painter)
        else:
            # Otherwise, use the default painting method.
            super().paint(painter, option, index) # Call super for non-HTML

        painter.restore()

class UmaAnalyzerPyQt(QMainWindow):
    """The main application window for the Umamusume Runner Analyzer."""
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Umamusume: Pretty Derby - Runner Analyzer")
        # Ensure BASE_DIR is correctly set relative to this script
        icon_path_jpg = os.path.join(BASE_DIR, 'assets', 'icon.jpg')
        icon_path_png = os.path.join(BASE_DIR, 'assets', 'icon.png')
        if os.path.exists(icon_path_png):
            self.setWindowIcon(QIcon(icon_path_png))
        elif os.path.exists(icon_path_jpg):
            self.setWindowIcon(QIcon(icon_path_jpg))
        else:
            logging.warning("Application icon not found in assets directory.")

        self.setGeometry(100, 100, 1800, 1000)

        self.data = self.load_data()
        self.spark_info = self.load_spark_designations()
        self.skill_types = self.load_skill_types()
        self.racers = self.load_racers()
        self.open_dialogs = []
        # --- Initialize filter widget lists ---
        self.spark_filter_widgets = [] # To hold spark filters + labels
        self.aptitude_filter_widgets = [] # To hold new aptitude filters + labels

        if self.data is None or self.spark_info is None or self.racers is None or self.skill_types is None:
            logging.critical("Failed to load necessary data files. Exiting.")
            QMessageBox.critical(self, "Data Loading Error", "Failed to load necessary data files (all_runners.csv, sparks.json, etc.).\nPlease check the 'data' and 'data/game_data' folders.\nSee app.log for details.")
            sys.exit(1) # Exit after showing message

        self.init_ui()
        # Apply filters only after UI is fully initialized
        QApplication.instance().processEvents() # Ensure UI elements are created
        self.apply_filters()


    def load_data(self):
        """Loads and preprocesses the main runner data from a CSV file."""
        # --- Use path relative to BASE_DIR ---
        file_path = os.path.join(BASE_DIR, 'data', 'all_runners.csv')
        if not os.path.exists(file_path):
            logging.error(f"Main data file not found at: {file_path}")
            return None
        try:
            df = pd.read_csv(file_path)
            # Handle potential JSON parsing errors
            def safe_json_loads(x):
                if pd.isna(x): return []
                try:
                    cleaned_x = str(x).strip()
                    cleaned_x = re.sub(r',\s*]', ']', cleaned_x)
                    cleaned_x = re.sub(r',\s*}', '}', cleaned_x)
                    # Handle potential non-string values passed
                    if not isinstance(cleaned_x, str):
                        logging.warning(f"Non-string value encountered for JSON parsing: {cleaned_x}")
                        return []
                    return json.loads(cleaned_x)
                except json.JSONDecodeError as e:
                    logging.warning(f"Failed to decode JSON: {e} - Data: '{x}'")
                    return []
                except Exception as e:
                     logging.error(f"Unexpected error parsing JSON: {e} - Data: '{x}'")
                     return []

            df['sparks'] = df['sparks'].apply(safe_json_loads)
            stat_cols = ['speed', 'stamina', 'power', 'guts', 'wit', 'score']
            for col in stat_cols:
                # Convert to numeric, coerce errors, fill NaN with 0, then convert to integer
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)
            # Ensure aptitude columns are strings and handle potential NaN/float types
            aptitude_cols = [f'rank_{apt}' for apt in ['turf', 'dirt', 'sprint', 'mile', 'medium', 'long', 'front', 'pace', 'late', 'end']]
            for col in aptitude_cols:
                if col in df.columns:
                    df[col] = df[col].fillna('N/A').astype(str) # Fill NaN before converting to string
            logging.info("Runner data loaded successfully.")
            return df
        except Exception as e:
            logging.exception(f"Error loading or processing {file_path}:")
            return None


    def load_spark_designations(self):
        """Loads spark metadata from a JSON file."""
        # --- Use path relative to BASE_DIR ---
        file_path = os.path.join(BASE_DIR, 'data', 'game_data', 'sparks.json')
        if not os.path.exists(file_path):
            logging.error(f"Sparks file not found at: {file_path}")
            return None
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            logging.info("Spark designations loaded successfully.")
            return data
        except Exception as e:
            logging.exception(f"Failed to load or parse sparks.json:")
            return None

    def load_skill_types(self):
        """Loads skill type mappings from a JSON file."""
         # --- Use path relative to BASE_DIR ---
        file_path = os.path.join(BASE_DIR, 'data', 'game_data', 'skill_types.json')
        if not os.path.exists(file_path):
            logging.error(f"Skill types file not found at: {file_path}")
            return None
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            logging.info("Skill types loaded successfully.")
            return data
        except Exception as e:
            logging.exception(f"Failed to load or parse skill_types.json:")
            return None

    def load_racers(self):
        """Gets a unique, sorted list of runner names from the data."""
        if self.data is None:
            logging.warning("Cannot load racers, main data is missing.")
            return ['']
        try:
            # Drop NaN/empty names before getting unique, then sort
            unique_names = sorted(self.data['name'].dropna().astype(str).unique())
            logging.info(f"Loaded {len(unique_names)} unique racers.")
            return [''] + unique_names
        except KeyError:
            logging.error("Column 'name' not found in the data. Cannot load racers.")
            return ['']
        except Exception as e:
             logging.exception("Error loading racers:")
             return ['']


    def _get_taskbar_height(self):
        """Calculates the height of the Windows taskbar to avoid window overlap."""
        # --- Kept improved taskbar logic ---
        if os.name == 'nt':
            try:
                taskbar_handle = ctypes.windll.user32.FindWindowW("Shell_TrayWnd", None)
                if not taskbar_handle: return 0
                rect = ctypes.wintypes.RECT()
                if not ctypes.windll.user32.GetWindowRect(taskbar_handle, ctypes.byref(rect)): return 0

                taskbar_height = rect.bottom - rect.top
                taskbar_width = rect.right - rect.left
                screen_width = ctypes.windll.user32.GetSystemMetrics(0) # SM_CXSCREEN
                screen_height = ctypes.windll.user32.GetSystemMetrics(1) # SM_CYSCREEN


                # Check if taskbar is horizontal (top/bottom) or vertical (left/right)
                is_horizontal = taskbar_width == screen_width
                is_vertical = taskbar_height == screen_height

                # Return height if at bottom OR top
                if is_horizontal:
                    # Check if it's at the top (rect.top == 0) or bottom
                    if rect.top == 0 or rect.bottom == screen_height:
                         return taskbar_height
                    else: # Auto-hide? Difficult to detect reliably. Assume 0 if not top/bottom.
                         return 0
                else: # Vertical or floating/hidden?
                    return 0 # Assume 0 height impact for vertical/other taskbars

            except Exception as e:
                logging.error(f"Exception while getting taskbar height: {e}")
                return 0
        return 0 # Default for non-Windows OS


    def _remove_dialog_from_list(self, dialog_to_remove):
        """Removes a closed dialog from the list of open dialogs."""
        try:
            self.open_dialogs.remove(dialog_to_remove)
        except ValueError:
            pass # Ignore if already removed

    def show_runner_details(self, row, column):
        """Opens a detailed dialog window for the selected runner."""
        taskbar_height = self._get_taskbar_height()
        # --- Determine source table based on current tab ---
        current_index = self.tabs.currentIndex()
        if current_index == 0:
            table = self.tables["Stats Summary"]
        elif current_index == 1:
             table = self.tables["Aptitude Summary"]
        else:
             # Try getting table from current index directly if names change
             widget = self.tabs.widget(current_index)
             table = widget.findChild(QTableWidget) if widget else None
             if not table:
                 logging.warning("Double-click details triggered on unexpected tab or table not found.")
                 return

        # Dynamically find the 'Entry Id' column header text
        entry_id_col_index = -1
        for i in range(table.columnCount()):
            header = table.horizontalHeaderItem(i)
            if header and header.text().lower() == "entry id":
                entry_id_col_index = i
                break

        if entry_id_col_index == -1:
             current_tab_name = self.tabs.tabText(current_index)
             logging.warning(f"Could not find 'Entry Id' column in '{current_tab_name}' table.")
             return

        entry_id_item = table.item(row, entry_id_col_index)
        if not entry_id_item:
            logging.warning(f"No item found at row {row}, column {entry_id_col_index} (Entry Id).")
            return

        try:
            entry_id = int(entry_id_item.text())
        except ValueError:
             logging.warning(f"Invalid Entry Id text: '{entry_id_item.text()}'")
             return

        # Fetch data using the entry_id from the original self.data DataFrame
        selected_runner_df = self.data[self.data['entry_id'] == entry_id]
        if selected_runner_df.empty:
            logging.warning(f"No runner found in original data with Entry Id: {entry_id}")
            return

        runner_data = selected_runner_df.iloc[0].to_dict()

        # Create, position, and show the dialog.
        dialog = UmaDetailDialog(runner_data, self.spark_info, self.skill_types, self)
        self.open_dialogs.append(dialog)
        dialog.finished.connect(lambda result, d=dialog: self._remove_dialog_from_list(d))

        screen_geometry = QApplication.desktop().availableGeometry()
        screen_geometry.setHeight(max(100, screen_geometry.height() - taskbar_height))
        dialog_width = 600
        dialog_height = min(900, screen_geometry.height() - 20)
        dialog_width = min(dialog_width, screen_geometry.width() - 20)

        x = screen_geometry.x() + max(0, (screen_geometry.width() - dialog_width) / 2)
        y = screen_geometry.y() + max(0, (screen_geometry.height() - dialog_height) / 2)
        dialog.setGeometry(int(x), int(y), dialog_width, dialog_height)
        dialog.show()

    def init_ui(self):
        """Initializes the main window UI, including tabs, tables, and filter controls."""
        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        self.layout = QHBoxLayout(self.central_widget)

        self.controls_groupbox = QGroupBox("Filters and Controls")
        self.controls_groupbox.setLayout(QVBoxLayout())
        self.controls_groupbox.setFixedWidth(250)
        self.layout.addWidget(self.controls_groupbox)

        self.controls_widget = QWidget()
        self.controls_widget.setMinimumWidth(200) # Keep minimum width
        self.controls_layout = QVBoxLayout(self.controls_widget)
        # Added margins to controls layout for spacing from groupbox border
        self.controls_layout.setContentsMargins(9, 9, 9, 9)
        self.controls_groupbox.layout().addWidget(self.controls_widget)

        self.tabs = QTabWidget()
        self.layout.addWidget(self.tabs)

        # --- Setup Tab Widgets ---
        self.tab_widgets = {}
        self.tables = {}
        # --- Changed tab order ---
        tab_names = ["Stats Summary", "Aptitude Summary", "White Sparks", "Skills Summary"]
        for name in tab_names:
            tab = QWidget()
            tab.setObjectName(name.replace(" ", "_")) # Set object name
            self.tabs.addTab(tab, name)
            layout = QVBoxLayout(tab)
            layout.setContentsMargins(5, 5, 5, 5) # Keep small margins
            self.tab_widgets[name] = layout
            table = QTableWidget()
            table.setObjectName(f"table_{name.replace(' ', '_')}")
            table.verticalHeader().setVisible(False)
            table.setAlternatingRowColors(True) # Keep alternating rows
            table.setSortingEnabled(True)

            # Set resize mode based on tab
            if name == "Aptitude Summary":
                 table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch) # Stretch aptitudes
            elif name == "Stats Summary":
                 table.horizontalHeader().setSectionResizeMode(QHeaderView.Interactive) # Interactive for stats
            else: # Default for others (can be adjusted)
                 table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeToContents)

            table.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOn)
            self.tables[name] = table
            layout.addWidget(table)

        # Set delegates and connect signals
        self.tables["Stats Summary"].setItemDelegate(RichTextDelegate(self))
        self.tables["Stats Summary"].cellDoubleClicked.connect(self.show_runner_details)
        self.tables["Aptitude Summary"].setItemDelegate(RichTextDelegate(self))
        self.tables["Aptitude Summary"].cellDoubleClicked.connect(self.show_runner_details)

        # --- Connect tab change signal ---
        self.tabs.currentChanged.connect(self.handle_tab_change)

        # --- Setup Controls ---
        self.controls = {}
        self.default_controls = {}
        self.spark_filter_widgets = [] # Reset lists
        self.aptitude_filter_widgets = []

        reset_button = QPushButton("Reset Filters")
        reset_button.clicked.connect(self.reset_filters)
        self.controls_layout.addWidget(reset_button)

        # --- Basic Filters (Runner, Sort, Stats - Always Visible) ---
        sort_by_options = ['Name', 'Score', 'Speed', 'Stamina', 'Power', 'Guts', 'Wit', 'White Spark Count']
        aptitude_sort_options = ['Turf', 'Dirt', 'Sprint', 'Mile', 'Medium', 'Long', 'Front', 'Pace', 'Late', 'End']
        sort_by_options.extend(aptitude_sort_options)

        racers_list = self.racers if isinstance(self.racers, list) and self.racers else ['']

        # Pass None for layout_group for always-visible controls
        self.add_control('runner_filter', 'Runner', QComboBox(), racers_list, '', layout_group=None)
        self.add_control('sort_by', 'Sort By', QComboBox(), sort_by_options, 'Name', layout_group=None)
        self.add_control('sort_dir', 'Sort Direction', QComboBox(), ['ASC', 'DESC'], 'ASC', layout_group=None)
        for stat in ['speed', 'stamina', 'power', 'guts', 'wit']:
            self.add_control(stat, f"Min {stat.title()}", QSlider(Qt.Horizontal), default_value=0, layout_group=None)

        line = QFrame()
        line.setFrameShape(QFrame.HLine)
        line.setFrameShadow(QFrame.Sunken)
        self.controls_layout.addWidget(line) # Keep separator

        # --- Spark Filters (Store references in self.spark_filter_widgets) ---
        blue_spark_options = [''] + (self.spark_info.get('blue', []) if self.spark_info else [])
        pink_spark_options = [''] + (self.spark_info.get('pink', []) if self.spark_info else [])
        white_spark_options = ['']
        if self.spark_info and 'white' in self.spark_info:
             white_spark_options += self.spark_info['white'].get('race', []) + self.spark_info['white'].get('skill', [])

        # Pass self.spark_filter_widgets
        self.add_control('filter_rep', 'Rep. Sparks Only', QCheckBox(), default_value=False, layout_group=self.spark_filter_widgets)
        self.add_control('filter_blue', 'Blue Spark', QComboBox(), blue_spark_options, '', layout_group=self.spark_filter_widgets)
        self.add_control('min_blue', 'Min Blue Count', QComboBox(), [''] + [str(i) for i in range(1, 10)], '', layout_group=self.spark_filter_widgets)
        self.add_control('filter_pink', 'Pink Spark', QComboBox(), pink_spark_options, '', layout_group=self.spark_filter_widgets)
        self.add_control('min_pink', 'Min Pink Count', QComboBox(), [''] + [str(i) for i in range(1, 10)], '', layout_group=self.spark_filter_widgets)
        self.add_control('filter_white', 'White Spark', QComboBox(), white_spark_options, '', layout_group=self.spark_filter_widgets)
        self.add_control('min_white', 'Min White Count', QComboBox(), [''] + [str(i) for i in range(1, 10)], '', layout_group=self.spark_filter_widgets)

        # --- New Aptitude Filters (Store references in self.aptitude_filter_widgets) ---
        aptitude_grades = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G', ''] # Include empty
        default_apt_grade = 'A'

        # Track Aptitudes
        apt_track_label = QLabel("Min Track Grade:")
        self.controls_layout.addWidget(apt_track_label)
        self.aptitude_filter_widgets.append(apt_track_label) # Add label to list
        track_layout = QHBoxLayout()
        # Pass self.aptitude_filter_widgets and specific_layout
        self.add_control('apt_min_turf', 'Turf', QComboBox(), aptitude_grades, default_apt_grade, layout_group=self.aptitude_filter_widgets, specific_layout=track_layout)
        self.add_control('apt_min_dirt', 'Dirt', QComboBox(), aptitude_grades, default_apt_grade, layout_group=self.aptitude_filter_widgets, specific_layout=track_layout)
        self.controls_layout.addLayout(track_layout)

        # Distance Aptitudes
        apt_dist_label = QLabel("Min Distance Grade:")
        self.controls_layout.addWidget(apt_dist_label)
        self.aptitude_filter_widgets.append(apt_dist_label)
        dist_layout_1 = QHBoxLayout()
        dist_layout_2 = QHBoxLayout()
        self.add_control('apt_min_sprint', 'Sprint', QComboBox(), aptitude_grades, default_apt_grade, layout_group=self.aptitude_filter_widgets, specific_layout=dist_layout_1)
        self.add_control('apt_min_mile', 'Mile', QComboBox(), aptitude_grades, default_apt_grade, layout_group=self.aptitude_filter_widgets, specific_layout=dist_layout_1)
        self.add_control('apt_min_medium', 'Medium', QComboBox(), aptitude_grades, default_apt_grade, layout_group=self.aptitude_filter_widgets, specific_layout=dist_layout_2)
        self.add_control('apt_min_long', 'Long', QComboBox(), aptitude_grades, default_apt_grade, layout_group=self.aptitude_filter_widgets, specific_layout=dist_layout_2)
        self.controls_layout.addLayout(dist_layout_1)
        self.controls_layout.addLayout(dist_layout_2)

        # Style Aptitudes
        apt_style_label = QLabel("Min Style Grade:")
        self.controls_layout.addWidget(apt_style_label)
        self.aptitude_filter_widgets.append(apt_style_label)
        style_layout_1 = QHBoxLayout()
        style_layout_2 = QHBoxLayout()
        self.add_control('apt_min_front', 'Front', QComboBox(), aptitude_grades, default_apt_grade, layout_group=self.aptitude_filter_widgets, specific_layout=style_layout_1)
        self.add_control('apt_min_pace', 'Pace', QComboBox(), aptitude_grades, default_apt_grade, layout_group=self.aptitude_filter_widgets, specific_layout=style_layout_1)
        self.add_control('apt_min_late', 'Late', QComboBox(), aptitude_grades, default_apt_grade, layout_group=self.aptitude_filter_widgets, specific_layout=style_layout_2)
        self.add_control('apt_min_end', 'End', QComboBox(), aptitude_grades, default_apt_grade, layout_group=self.aptitude_filter_widgets, specific_layout=style_layout_2)
        self.controls_layout.addLayout(style_layout_1)
        self.controls_layout.addLayout(style_layout_2)


        # --- Final Layout Adjustments ---
        self.controls_layout.addStretch(1) # Keep stretch at the bottom

        # --- Initial Filter Visibility ---
        self.handle_tab_change(self.tabs.currentIndex()) # Set initial visibility


    # --- Modified add_control method ---
    def add_control(self, name, label, widget, options=None, default_value=None, layout_group=None, specific_layout=None):
        """A helper method to create and add a filter control to the layout."""
        control_label = QLabel(label)
        self.controls[name] = widget
        self.default_controls[name] = default_value

        # Determine target layout
        target_layout = specific_layout if specific_layout is not None else self.controls_layout

        # Widgets to add to the layout group for visibility control
        widgets_to_group = []

        if isinstance(widget, QSlider):
            widget.setRange(0, 1200)
            widget.setSingleStep(1)
            widget.installEventFilter(self)
            slider_layout = QHBoxLayout()
            # Use default_value for initial LineEdit text
            num_input = QLineEdit(str(default_value if default_value is not None else 0))
            num_input.setFixedWidth(50)

            # Add label to main layout ONLY if slider isn't in a specific_layout
            if specific_layout is None:
                 self.controls_layout.addWidget(control_label)
                 # If also grouped, add label to group list for hiding
                 if layout_group is not None:
                      widgets_to_group.append(control_label)

            slider_layout.addWidget(widget)
            slider_layout.addWidget(num_input)
            target_layout.addLayout(slider_layout) # Add slider+input layout to target

            # Connect signals
            widget.valueChanged.connect(lambda v, le=num_input: le.setText(str(v)))
            num_input.textChanged.connect(lambda t, s=widget: s.setValue(int(t) if t.isdigit() and 0 <= int(t) <= 1200 else (0 if not t.isdigit() or int(t) < 0 else 1200)))
            widget.valueChanged.connect(self.apply_filters)

            # Add widgets to layout_group if specified
            widgets_to_group.append(widget)
            widgets_to_group.append(num_input)
            # We hide individual widgets, not the QHBoxLayout itself

        elif isinstance(widget, QCheckBox):
            # Checkbox uses its own text property for the label
            widget.setText(label)
            target_layout.addWidget(widget) # Add checkbox directly
            widgets_to_group.append(widget) # Add only checkbox to group
        else:
             # Standard widgets (ComboBox, LineEdit)
             if specific_layout is not None:
                  # For HBoxes, add label and widget directly
                  target_layout.addWidget(control_label)
                  target_layout.addWidget(widget)
                  widgets_to_group.append(control_label)
                  widgets_to_group.append(widget)
             else: # Add directly to main controls layout (VBox)
                  target_layout.addWidget(control_label)
                  target_layout.addWidget(widget)
                  widgets_to_group.append(control_label)
                  widgets_to_group.append(widget)


        # Add items to ComboBox
        if isinstance(widget, QComboBox) and options: widget.addItems(options)

        # Set default value
        if default_value is not None:
            if isinstance(widget, QComboBox):
                 index = widget.findText(str(default_value), Qt.MatchFixedString)
                 widget.setCurrentIndex(index if index >= 0 else 0)
            elif isinstance(widget, QCheckBox): widget.setChecked(default_value)
            # Slider default handled during creation

        # Connect signals (moved some connections from slider block)
        if isinstance(widget, QComboBox): widget.currentIndexChanged.connect(self.apply_filters)
        # elif isinstance(widget, QLineEdit): # Only connect if it's NOT the slider's LineEdit
        #     is_slider_le = False
        #     # Check parent layout items... (complex, maybe avoid?)
        #     # For now, assuming only slider LineEdits exist
        #     pass
        elif isinstance(widget, QCheckBox) and name == 'filter_rep':
             # Ensure connection doesn't duplicate
             try: widget.stateChanged.disconnect(self.toggle_rep_filter)
             except TypeError: pass
             widget.stateChanged.connect(self.toggle_rep_filter)
        elif isinstance(widget, QCheckBox): # Other checkboxes trigger apply_filters
             try: widget.stateChanged.disconnect(self.apply_filters)
             except TypeError: pass
             widget.stateChanged.connect(self.apply_filters)

        # Add collected widgets to the specified layout group *list*
        if layout_group is not None:
            layout_group.extend(widgets_to_group)


    def eventFilter(self, obj, event):
        """Catches wheel events on sliders to allow scrolling to change their value."""
        # --- Reverted wheel step size ---
        if isinstance(obj, QSlider) and event.type() == QEvent.Wheel:
            delta = event.angleDelta().y()
            # Original small step for wheel
            step = obj.singleStep()
            if delta > 0:
                obj.setValue(min(obj.maximum(), obj.value() + step))
            elif delta < 0:
                obj.setValue(max(obj.minimum(), obj.value() - step))
            return True
        return super().eventFilter(obj, event)

    # --- Modified reset_filters method ---
    def reset_filters(self):
        """Resets relevant filter controls based on the current tab."""
        current_tab_index = self.tabs.currentIndex()
        is_aptitude_tab = (current_tab_index == 1)
        logging.info(f"Resetting filters. Aptitude tab active: {is_aptitude_tab}")

        spark_filter_names = ['filter_rep', 'filter_blue', 'min_blue', 'filter_pink', 'min_pink', 'filter_white', 'min_white']
        aptitude_filter_names = [name for name in self.controls if name.startswith('apt_min_')]

        # Disconnect signals temporarily to prevent multiple updates during reset
        signal_blockers = {}
        for name, widget in self.controls.items():
            try:
                signal_blockers[widget] = widget.blockSignals(True)
                # Also block LineEdit signals associated with sliders
                if isinstance(widget, QSlider):
                     layout_item = widget.parentWidget().layout().itemAt(widget.parentWidget().layout().indexOf(widget) + 1)
                     if layout_item and isinstance(layout_item.widget(), QLineEdit):
                          le = layout_item.widget()
                          signal_blockers[le] = le.blockSignals(True)
            except Exception as e:
                 logging.error(f"Error blocking signal for {name}: {e}")


        # Reset values based on tab
        for name, widget in self.controls.items():
            # Determine if this control should be reset on this tab
            should_reset = True
            if is_aptitude_tab and name in spark_filter_names:
                should_reset = False
            elif not is_aptitude_tab and name in aptitude_filter_names:
                should_reset = False

            if should_reset:
                default_value = self.default_controls.get(name)
                # logging.debug(f"Resetting '{name}' to '{default_value}'") # Debug logging
                if isinstance(widget, QComboBox):
                     index = widget.findText(str(default_value) if default_value is not None else '', Qt.MatchFixedString)
                     widget.setCurrentIndex(index if index >= 0 else 0)
                elif isinstance(widget, QSlider):
                    new_value = default_value if default_value is not None else 0
                    widget.setValue(new_value)
                    # Update associated QLineEdit
                    layout_item = widget.parentWidget().layout().itemAt(widget.parentWidget().layout().indexOf(widget) + 1)
                    if layout_item and isinstance(layout_item.widget(), QLineEdit):
                         layout_item.widget().setText(str(new_value))
                elif isinstance(widget, QCheckBox):
                     widget.setChecked(default_value if default_value is not None else False)
            # else:
            #     logging.debug(f"Skipping reset for '{name}' on this tab.") # Debug logging


        # Restore signals
        for widget, was_blocked in signal_blockers.items():
             try:
                widget.blockSignals(was_blocked)
             except Exception as e: # Catch potential errors if widget was deleted
                 logging.error(f"Error restoring signal for widget {widget}: {e}")

        # Special handling for filter_rep checkbox connection if it was reset
        if 'filter_rep' in self.controls and not is_aptitude_tab:
            rep_checkbox = self.controls['filter_rep']
            try: rep_checkbox.stateChanged.disconnect(self.toggle_rep_filter)
            except TypeError: pass
            rep_checkbox.stateChanged.connect(self.toggle_rep_filter)


        # Trigger a single update after resetting
        self.apply_filters()


    # --- New method handle_tab_change ---
    def handle_tab_change(self, index):
        """Shows/hides filter sections based on the selected tab."""
        is_aptitude_tab = (index == 1) # Aptitude Summary is index 1
        logging.debug(f"Tab changed to index {index}. Is Aptitude Tab: {is_aptitude_tab}")

        # Toggle Spark Filters visibility
        for widget in self.spark_filter_widgets:
            if widget: # Check widget exists
                widget.setVisible(not is_aptitude_tab)

        # Toggle Aptitude Filters visibility
        for widget in self.aptitude_filter_widgets:
            if widget: # Check widget exists
                widget.setVisible(is_aptitude_tab)

        # Optional: Trigger re-filter when tab changes? Could be slow.
        # self.apply_filters()


    def toggle_rep_filter(self):
        """Adjusts the range of spark count filters when the 'Representative Only' checkbox is toggled."""
        is_rep = self.controls['filter_rep'].isChecked()
        new_range = [''] + [str(i) for i in range(1, 4)] if is_rep else [''] + [str(i) for i in range(1, 10)]

        for key in ['min_blue', 'min_pink', 'min_white']:
             if key in self.controls:
                widget = self.controls[key]
                current_val = widget.currentText()
                widget.blockSignals(True)
                widget.clear()
                widget.addItems(new_range)
                widget.blockSignals(False)

                # Try restoring selection or adjusting
                new_index = widget.findText(current_val)
                if new_index != -1:
                     widget.setCurrentIndex(new_index)
                elif current_val and current_val.isdigit():
                    val_int = int(current_val)
                    if is_rep and val_int > 3:
                        widget.setCurrentText('3') # Clamp down
                    # No need to clamp up when switching back from rep only
                    elif not is_rep:
                        # Should find the original value unless it was > 9 originally
                        idx = widget.findText(current_val)
                        widget.setCurrentIndex(idx if idx !=-1 else 0)
                    else: # If it was > 3 and now is_rep, set to max '3'
                         widget.setCurrentText('3')
                else:
                    widget.setCurrentIndex(0) # Default to empty

        self.apply_filters()

    # --- Modified apply_filters method ---
    def apply_filters(self):
        """Applies filters relevant to the currently viewed or all tabs."""
        if self.data is None:
            logging.error("apply_filters called but self.data is None. Aborting.")
            return

        # Fetch current control values
        controls = {}
        for key, w in self.controls.items():
            if isinstance(w, QComboBox): controls[key] = w.currentText()
            elif isinstance(w, QLineEdit): controls[key] = w.text() # Should only be slider LEs
            elif isinstance(w, QCheckBox): controls[key] = w.isChecked()
            elif isinstance(w, QSlider): controls[key] = w.value()

        try:
            # --- Filtering for Stats Summary Tab ---
            # Apply Runner, Stats, and Spark filters
            filtered_df_stats = self.filter_data(self.data.copy(), controls, apply_sparks=True, apply_aptitudes=False)
            stats_summary_df = self.generate_stats_summary_columns(filtered_df_stats.copy(), controls)
            self.update_table(self.tables["Stats Summary"], stats_summary_df, controls)

            # --- Filtering for Aptitude Summary Tab ---
            # Apply Runner, Stats filters first (no sparks)
            base_filtered_df_apt = self.filter_data(self.data.copy(), controls, apply_sparks=False, apply_aptitudes=False)
            # Then apply Aptitude Grade filters
            filtered_df_apt = self.apply_aptitude_grade_filters(base_filtered_df_apt, controls)
            aptitude_summary_df = self.generate_aptitude_summary_columns(filtered_df_apt.copy(), controls)
            self.update_table(self.tables["Aptitude Summary"], aptitude_summary_df, controls)

            # --- Placeholder for updating other tabs ---
            # If these tabs exist, they likely need spark filters applied
            if "White Sparks" in self.tables or "Skills Summary" in self.tables:
                 filtered_df_other = self.filter_data(self.data.copy(), controls, apply_sparks=True, apply_aptitudes=False)
                 if "White Sparks" in self.tables:
                      # white_spark_df = self.generate_white_spark_columns(filtered_df_other.copy(), controls)
                      # self.update_table(self.tables["White Sparks"], white_spark_df, controls)
                      pass # Add generation logic later
                 if "Skills Summary" in self.tables:
                      # skills_df = self.generate_skills_columns(filtered_df_other.copy(), controls)
                      # self.update_table(self.tables["Skills Summary"], skills_df, controls)
                      pass # Add generation logic later


        except Exception as e:
            logging.exception(f"Error during filtering or table update:") # Log stack trace

    # --- Modified filter_data method ---
    def filter_data(self, df, controls, apply_sparks=True, apply_aptitudes=False):
        """Filters the main DataFrame based on controls and specified filter types."""
        # --- Runner Filter ---
        runner_filter = controls.get('runner_filter')
        if runner_filter:
            # Use boolean indexing carefully, handle potential missing 'name' column
            if 'name' in df.columns:
                 df = df[df['name'] == runner_filter]
            else:
                 logging.warning("'name' column not found for runner filter.")

        # --- Stat Filters ---
        for stat in ['speed', 'stamina', 'power', 'guts', 'wit']:
            min_val = controls.get(stat, 0)
            if min_val > 0:
                if stat in df.columns:
                     # Convert column to numeric, coercing errors, fill NA with 0 before comparison
                     df = df[pd.to_numeric(df[stat], errors='coerce').fillna(0) >= min_val]
                else:
                     logging.warning(f"Stat filter column '{stat}' not found.")


        # --- Spark Filters (Conditional) ---
        if apply_sparks:
            use_rep_only = controls.get('filter_rep', False)
            conditions = []

            # Blue Spark Filter Logic (Copied from previous correct version)
            filter_blue = controls.get('filter_blue')
            min_blue_str = controls.get('min_blue')
            min_blue = int(min_blue_str) if min_blue_str and min_blue_str.isdigit() else 0
            if filter_blue or min_blue > 0:
                def check_blue(sparks):
                    if not isinstance(sparks, list): return False
                    spark_list = [s for s in sparks if isinstance(s, dict) and s.get('color') == 'blue']
                    if use_rep_only: spark_list = [s for s in spark_list if s.get('type') == 'representative']
                    if filter_blue:
                        spark_sum = sum(int(s.get('count', 0)) for s in spark_list if s.get('spark_name') == filter_blue)
                        return spark_sum >= min_blue if min_blue > 0 else spark_sum > 0
                    elif min_blue > 0:
                        spark_counts = {}
                        for s in spark_list:
                            s_name = s.get('spark_name')
                            if s_name: spark_counts[s_name] = spark_counts.get(s_name, 0) + int(s.get('count', 0))
                        return any(total >= min_blue for total in spark_counts.values())
                    return True
                conditions.append(df['sparks'].apply(check_blue))

            # Pink Spark Filter Logic (Copied from previous correct version)
            filter_pink = controls.get('filter_pink')
            min_pink_str = controls.get('min_pink')
            min_pink = int(min_pink_str) if min_pink_str and min_pink_str.isdigit() else 0
            if filter_pink or min_pink > 0:
                def check_pink(sparks):
                    if not isinstance(sparks, list): return False
                    spark_list = [s for s in sparks if isinstance(s, dict) and s.get('color') == 'pink']
                    if use_rep_only: spark_list = [s for s in spark_list if s.get('type') == 'representative']
                    if filter_pink:
                        spark_sum = sum(int(s.get('count', 0)) for s in spark_list if s.get('spark_name') == filter_pink)
                        return spark_sum >= min_pink if min_pink > 0 else spark_sum > 0
                    elif min_pink > 0:
                        spark_counts = {}
                        for s in spark_list:
                             s_name = s.get('spark_name')
                             if s_name: spark_counts[s_name] = spark_counts.get(s_name, 0) + int(s.get('count', 0))
                        return any(total >= min_pink for total in spark_counts.values())
                    return True
                conditions.append(df['sparks'].apply(check_pink))

            # White Spark Filter Logic (Copied from previous correct version)
            filter_white = controls.get('filter_white')
            min_white_str = controls.get('min_white')
            min_white = int(min_white_str) if min_white_str and min_white_str.isdigit() else 0
            if filter_white or min_white > 0:
                def check_white(sparks):
                    if not isinstance(sparks, list): return False
                    spark_list = [s for s in sparks if isinstance(s, dict) and s.get('color') == 'white']
                    if use_rep_only: spark_list = [s for s in spark_list if s.get('type') == 'representative']
                    if filter_white:
                         # Ensure count check handles potential non-integer counts safely
                         return any(
                             s.get('spark_name') == filter_white and
                             int(s.get('count', 0)) >= min_white for s in spark_list
                         ) if min_white > 0 else any(s.get('spark_name') == filter_white for s in spark_list)
                    elif min_white > 0:
                         return any(int(s.get('count', 0)) >= min_white for s in spark_list)
                    return True
                conditions.append(df['sparks'].apply(check_white))


            # Apply spark conditions
            if conditions:
                final_condition = pd.Series(True, index=df.index)
                for cond in conditions:
                    # Align index before combining
                    cond = cond.reindex(df.index, fill_value=True) # Fill missing indices as True (don't filter them out)
                    final_condition &= cond
                df = df[final_condition]

        # Note: apply_aptitudes parameter is no longer used here; filtering moved

        return df

    # --- New method apply_aptitude_grade_filters ---
    def apply_aptitude_grade_filters(self, df, controls):
        """Filters the DataFrame based on minimum aptitude grade controls."""
        # Map grades to numbers, empty/invalid is lowest (-100)
        aptitude_rank_map = {'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'E': 0, 'F': -1, 'G': -2, '': -100, 'N/A': -100}
        aptitude_filter_map = {
            'apt_min_turf': 'rank_turf', 'apt_min_dirt': 'rank_dirt',
            'apt_min_sprint': 'rank_sprint', 'apt_min_mile': 'rank_mile',
            'apt_min_medium': 'rank_medium', 'apt_min_long': 'rank_long',
            'apt_min_front': 'rank_front', 'apt_min_pace': 'rank_pace',
            'apt_min_late': 'rank_late', 'apt_min_end': 'rank_end'
        }

        conditions = []
        for control_name, df_col_name in aptitude_filter_map.items():
            min_grade_str = controls.get(control_name, '')
            # Only apply filter if a grade (not empty string) is selected
            if min_grade_str and df_col_name in df.columns:
                min_grade_val = aptitude_rank_map.get(min_grade_str.upper(), -100)

                # Map column to numeric, handle missing/invalid using fillna, then compare
                column_numeric_values = df[df_col_name].astype(str).str.upper().map(aptitude_rank_map).fillna(-100)
                condition = column_numeric_values >= min_grade_val
                conditions.append(condition)
            elif min_grade_str and df_col_name not in df.columns:
                 logging.warning(f"Aptitude filter column '{df_col_name}' not found.")

        # Apply all aptitude conditions
        if conditions:
            final_condition = pd.Series(True, index=df.index)
            for cond in conditions:
                 cond = cond.reindex(df.index, fill_value=True) # Align index
                 final_condition &= cond
            df = df[final_condition]

        return df


    def generate_stats_summary_columns(self, df, controls):
        """Generates computed columns for the stats summary table and sorts the data."""
        # --- Generate Spark Columns ---
        if 'sparks' not in df.columns:
             logging.error("'sparks' column missing, cannot generate spark summaries.")
             df['Blue Sparks'] = ''
             df['Pink Sparks'] = ''
             df['White Spark Count'] = '0(0)'
        else:
            df['Blue Sparks'] = df['sparks'].apply(lambda s: self.combine_sparks(s, 'blue'))
            df['Pink Sparks'] = df['sparks'].apply(lambda s: self.combine_sparks(s, 'pink'))
            def count_white_sparks(sparks): # Function copied from previous version
                if not isinstance(sparks, list): return "0(0)"
                total_count = sum(1 for sp in sparks if isinstance(sp, dict) and sp.get('color') == 'white')
                rep_count = sum(1 for sp in sparks if isinstance(sp, dict) and sp.get('color') == 'white' and sp.get('type') == 'representative')
                return f"{total_count}({rep_count})"
            df['White Spark Count'] = df['sparks'].apply(count_white_sparks)

        # --- Sorting Logic ---
        sort_by = controls.get('sort_by', 'Name').lower().replace(' ', '_')
        ascending = controls.get('sort_dir', 'ASC') == 'ASC'
        aptitude_rank_map = {'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'E': 0, 'F': -1, 'G': -2, '': -100, 'N/A': -100}

        try:
            if sort_by == 'white_spark_count':
                use_rep = controls.get('filter_rep', False)
                def get_sort_key(count_str):
                    match = re.match(r'(\d+)\((\d+)\)', str(count_str))
                    if match:
                        total, rep = map(int, match.groups())
                        return rep if use_rep else total
                    return -1
                # Ensure column exists before creating sort key
                if 'White Spark Count' in df.columns:
                     df['sort_key'] = df['White Spark Count'].apply(get_sort_key)
                     df = df.sort_values(by='sort_key', ascending=ascending, na_position='last').drop(columns=['sort_key'])
                else:
                     raise ValueError("White Spark Count column missing for sorting")

            elif sort_by in ['turf', 'dirt', 'sprint', 'mile', 'medium', 'long', 'front', 'pace', 'late', 'end']:
                sort_col_name = f'rank_{sort_by}'
                if sort_col_name in df.columns:
                     df['sort_key'] = df[sort_col_name].astype(str).str.upper().map(aptitude_rank_map).fillna(-100)
                     df = df.sort_values(by='sort_key', ascending=ascending, na_position='last').drop(columns=['sort_key'])
                else:
                     raise ValueError(f"Aptitude sort column {sort_col_name} not found")
            elif sort_by in df.columns:
                if pd.api.types.is_numeric_dtype(df[sort_by]):
                     df = df.sort_values(by=sort_by, ascending=ascending, na_position='last')
                else:
                     df = df.sort_values(by=sort_by, ascending=ascending, na_position='last', key=lambda col: col.astype(str).str.lower())
            else:
                 raise ValueError(f"Sort column '{sort_by}' not found")

        except Exception as e:
            logging.exception(f"Error during stats summary sorting by '{sort_by}':")
            logging.warning("Falling back to sorting by name.")
            # Ensure 'name' column exists before fallback sort
            if 'name' in df.columns:
                 df = df.sort_values(by='name', ascending=True, na_position='last')
            # Else, no sort possible? Or sort by index? Keep unsorted for now.

        # --- Select and Order Final Columns ---
        stats_summary_cols = ['entry_id', 'name', 'score', 'speed', 'stamina', 'power', 'guts', 'wit', 'Blue Sparks', 'Pink Sparks', 'White Spark Count']
        final_df = pd.DataFrame()
        for col in stats_summary_cols:
             if col in df.columns:
                  final_df[col] = df[col]
             else:
                  logging.warning(f"Missing column for Stats Summary: {col}. Adding as empty.")
                  final_df[col] = pd.Series([None] * len(df), index=df.index) # Use None/NaN for missing

        return final_df


    # --- Copied generate_aptitude_summary_columns method ---
    def generate_aptitude_summary_columns(self, df, controls):
        """Generates and selects columns for the aptitude summary table and sorts the data."""
        stat_cols = ['speed', 'stamina', 'power', 'guts', 'wit']
        aptitude_cols = [
            'rank_turf', 'rank_dirt', 'rank_sprint', 'rank_mile',
            'rank_medium', 'rank_long', 'rank_front', 'rank_pace',
            'rank_late', 'rank_end'
        ]
        required_cols = ['entry_id', 'name', 'score'] + stat_cols + aptitude_cols

        df_aptitude = pd.DataFrame(index=df.index)
        for col in required_cols:
            if col in df.columns:
                df_aptitude[col] = df[col]
            else:
                logging.warning(f"Column '{col}' missing for Aptitude Summary. Adding as 'N/A'.")
                df_aptitude[col] = 'N/A'

        sort_by = controls.get('sort_by', 'Name').lower().replace(' ', '_')
        ascending = controls.get('sort_dir', 'ASC') == 'ASC'
        aptitude_rank_map = {'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1, 'E': 0, 'F': -1, 'G': -2, '': -100, 'N/A': -100}

        try:
            sort_col_name = f'rank_{sort_by}' if sort_by in ['turf', 'dirt', 'sprint', 'mile', 'medium', 'long', 'front', 'pace', 'late', 'end'] else sort_by

            if sort_col_name in df_aptitude.columns and sort_col_name.startswith('rank_'):
                df_aptitude['sort_key'] = df_aptitude[sort_col_name].astype(str).str.upper().map(aptitude_rank_map).fillna(-100)
                df_aptitude = df_aptitude.sort_values(by='sort_key', ascending=ascending, na_position='last').drop(columns=['sort_key'])
            elif sort_by in df_aptitude.columns:
                if pd.api.types.is_numeric_dtype(df_aptitude[sort_by]):
                     df_aptitude = df_aptitude.sort_values(by=sort_by, ascending=ascending, na_position='last')
                else:
                     df_aptitude = df_aptitude.sort_values(by=sort_by, ascending=ascending, na_position='last', key=lambda col: col.astype(str).str.lower())
            elif sort_by == 'white_spark_count':
                logging.info("Sorting Aptitude tab by White Spark Count requested, falling back to Name sort.")
                if 'name' in df_aptitude.columns:
                     df_aptitude = df_aptitude.sort_values(by='name', ascending=True, na_position='last')
            else:
                 raise ValueError(f"Sort column '{sort_by}' not found")

        except Exception as e:
            logging.exception(f"Error during aptitude summary sorting by '{sort_by}':")
            logging.warning("Falling back to sorting by name.")
            if 'name' in df_aptitude.columns:
                 df_aptitude = df_aptitude.sort_values(by='name', ascending=True, na_position='last')

        return df_aptitude


    # --- Reverted combine_sparks to original version ---
    def combine_sparks(self, sparks_list, color):
        """Combines spark data for a single runner into a display string."""
        if not sparks_list or not isinstance(sparks_list, list): return "" # Handle None or non-list
        source_sparks = [s for s in sparks_list if isinstance(s, dict) and s.get('color') == color] # Added dict check
        total_map = {}
        for s in source_sparks:
             # Added check for spark_name existence and count validity
             name = s.get('spark_name')
             try: count = int(s.get('count', 0))
             except (ValueError, TypeError): count = 0
             if name: total_map[name] = total_map.get(name, 0) + count

        rep_map = {}
        for s in source_sparks:
             if s.get('type') == 'representative':
                 name = s.get('spark_name')
                 try: count = int(s.get('count', 0))
                 except (ValueError, TypeError): count = 0
                 if name: rep_map[name] = rep_map.get(name, 0) + count

        order = self.spark_info.get(color, []) if self.spark_info else []

        # Sort items: first by predefined order, then alphabetically for unknowns
        def sort_key(item):
            name = item[0]
            try:
                # Find index in order list, fallback to infinity if not found
                idx = order.index(name) if name in order else float('inf')
                return (idx, name)
            except ValueError:
                return (float('inf'), name) # Should not happen with 'in' check

        sorted_items = sorted(total_map.items(), key=sort_key)

        # Format output string, including only those with count > 0
        result_parts = []
        for name, total in sorted_items:
             if total > 0:
                rep_count = rep_map.get(name, 0)
                if rep_count > 0:
                     result_parts.append(f"{name} {total}({rep_count})")
                else:
                     result_parts.append(f"{name} {total}")

        return ", ".join(result_parts)


    def get_highlighted_spark_html(self, cell_value, color, controls):
        """Wraps spark text in bold tags if it matches the current filter."""
        # --- Reverted to original version ---
        filter_type = controls.get(f'filter_{color}')
        min_count_str = controls.get(f'min_{color}')
        min_count = int(min_count_str) if min_count_str and min_count_str.isdigit() else 0

        if not filter_type and not min_count > 0:
            return cell_value

        parts = cell_value.split(', ')
        highlighted_parts = []
        for part in parts:
            should_bold = False
            # Original logic relying on startsWith and regex for count
            if filter_type and part.strip().startswith(filter_type):
                should_bold = True
            elif not filter_type and min_count > 0:
                match = re.search(r' (\d+)', part) # Search for first number
                if match and int(match.group(1)) >= min_count:
                    should_bold = True

            highlighted_parts.append(f'<b>{part}</b>' if should_bold else part)
        return ", ".join(highlighted_parts)


    # --- Modified update_table method ---
    def update_table(self, table, df, controls):
        """Populates the QTableWidget with data from the filtered DataFrame."""
        current_tab_name = ""
        parent_widget = table.parentWidget()
        if parent_widget:
            tab_name_key = parent_widget.objectName().replace("_", " ")
            if tab_name_key in self.tables and self.tables[tab_name_key] == table:
                current_tab_name = tab_name_key
        logging.debug(f"Updating table for tab: '{current_tab_name}'")

        table.setSortingEnabled(False)
        table.clearContents()
        table.setRowCount(len(df))

        # --- Set Headers ---
        clean_headers = []
        col_map = {}
        for idx, c in enumerate(df.columns):
            header = c.replace('_', ' ').replace('rank ', '').title()
            clean_headers.append(header)
            col_map[header.lower()] = c
        table.setColumnCount(len(clean_headers))
        table.setHorizontalHeaderLabels(clean_headers)

        # --- Hide entry_id column ---
        entry_id_idx = -1
        original_entry_id_col = col_map.get('entry id')
        if original_entry_id_col in df.columns:
             try:
                  entry_id_idx = clean_headers.index('Entry Id')
                  table.setColumnHidden(entry_id_idx, True)
             except ValueError:
                  entry_id_idx = -1


        stat_cols_original = ['speed', 'stamina', 'power', 'guts', 'wit']

        # --- Populate Data ---
        for i, (index, row) in enumerate(df.iterrows()):
            for j, clean_header in enumerate(clean_headers):
                 original_col = col_map.get(clean_header.lower())
                 if not original_col or original_col not in row:
                     table.setItem(i, j, QTableWidgetItem("ERR"))
                     continue

                 # Still create hidden entry_id item
                 if j == entry_id_idx and entry_id_idx != -1:
                      item = QTableWidgetItem(str(row[original_col]))
                      table.setItem(i, j, item)
                      continue


                 cell_value = row[original_col]
                 display_text = ""
                 # Original formatting for score
                 if original_col == 'score' and isinstance(cell_value, (int, float)):
                      display_text = f"{cell_value:,}" # Keep original comma format
                 else:
                      display_text = str(cell_value)

                 item = QTableWidgetItem(display_text)

                 # --- Alignment (Reverted to original logic) ---
                 item.setTextAlignment(Qt.AlignCenter) # Default center
                 # Special alignment only for sparks in Stats Summary
                 if current_tab_name == "Stats Summary" and original_col in ['Blue Sparks', 'Pink Sparks']:
                     item.setTextAlignment(Qt.AlignLeft | Qt.AlignVCenter)

                 # --- Background Coloring ---
                 color_hex = None
                 grade = None
                 if original_col in stat_cols_original and isinstance(cell_value, (int, float)):
                    grade = get_grade_for_stat(cell_value)
                    color_hex = get_aptitude_grade_color(grade)
                 elif original_col.startswith('rank_'):
                    grade = str(cell_value).upper()
                    color_hex = get_aptitude_grade_color(grade)

                 if color_hex:
                     item.setBackground(QColor(color_hex).lighter(150))
                     # Keep optional bold for S/A aptitudes
                     if grade in ['S', 'A'] and original_col.startswith('rank_'):
                         font = item.font()
                         font.setBold(True)
                         item.setFont(font)

                 # --- HTML for Sparks (Stats Summary Only, original logic) ---
                 if current_tab_name == "Stats Summary" and original_col in ['Blue Sparks', 'Pink Sparks']:
                     html = self.get_highlighted_spark_html(str(cell_value), original_col.split()[0].lower(), controls)
                     item.setText(html) # Let delegate handle HTML

                 table.setItem(i, j, item)


        # --- Adjust column widths (Reverted to original logic, applied AFTER population) ---
        # Note: Original logic set modes *before* population, which is less ideal. Applying width *after*.
        if current_tab_name == "Stats Summary":
             for col_idx, clean_header in enumerate(clean_headers):
                 if col_idx == entry_id_idx and entry_id_idx != -1: continue
                 header_lower = clean_header.lower()
                 original_col = col_map.get(header_lower)

                 if original_col in ['score'] + stat_cols_original:
                     table.horizontalHeader().setSectionResizeMode(col_idx, QHeaderView.Fixed)
                     table.setColumnWidth(col_idx, 100) # Original fixed width
                 elif original_col == 'name':
                     table.horizontalHeader().setSectionResizeMode(col_idx, QHeaderView.Interactive)
                     table.setColumnWidth(col_idx, 150) # Original width
                 elif original_col == 'White Spark Count':
                      table.horizontalHeader().setSectionResizeMode(col_idx, QHeaderView.Interactive)
                      table.setColumnWidth(col_idx, 180) # Original width
                 elif 'Sparks' in clean_header: # Blue/Pink
                      table.horizontalHeader().setSectionResizeMode(col_idx, QHeaderView.Interactive) # Was Interactive originally
                      table.setColumnWidth(col_idx, 300) # Original width
                 else: # Default Stretch as per original file's behavior for unhandled columns
                      table.horizontalHeader().setSectionResizeMode(col_idx, QHeaderView.Stretch)

        elif current_tab_name == "Aptitude Summary":
             # Original file had Stretch for all columns in Aptitude summary (implicitly via header default)
             # Keep Stretch for aptitudes, but make others interactive/fixed like Stats Summary
             for col_idx, clean_header in enumerate(clean_headers):
                 if col_idx == entry_id_idx and entry_id_idx != -1: continue
                 header_lower = clean_header.lower()
                 original_col = col_map.get(header_lower)

                 if original_col in ['score'] + stat_cols_original:
                     table.horizontalHeader().setSectionResizeMode(col_idx, QHeaderView.Fixed)
                     table.setColumnWidth(col_idx, 100)
                 elif original_col == 'name':
                     table.horizontalHeader().setSectionResizeMode(col_idx, QHeaderView.Interactive)
                     table.resizeColumnToContents(col_idx) # Resize name to contents
                     table.setColumnWidth(col_idx, max(150, table.columnWidth(col_idx))) # Ensure min width
                 else: # Aptitudes
                     table.horizontalHeader().setSectionResizeMode(col_idx, QHeaderView.Stretch)


        # Re-hide entry_id if needed
        if entry_id_idx != -1 and not table.isColumnHidden(entry_id_idx):
            table.setColumnHidden(entry_id_idx, True)

        table.setSortingEnabled(True)


class UmaDetailDialog(QDialog):
    """A dialog window to show detailed information about a single runner."""
    def __init__(self, runner_data, spark_info, skill_types, parent=None):
        super().__init__(parent)
        self.setWindowTitle(f"Umamusume Details: {runner_data.get('name', 'N/A')}")
        self.setGeometry(200, 200, 600, 900)
        self.runner_data = runner_data
        self.spark_info = spark_info if spark_info else {}
        self.skill_types = skill_types if skill_types else {}
        self.setStyleSheet(QSS_DETAIL_DIALOG)
        self.init_ui()

    # Reverted to original symbol formatting
    def _format_skill_name_with_symbols(self, skill_name):
        """Wraps special symbols in skill names with HTML for proper rendering."""
        if not isinstance(skill_name, str): return ""
        return re.sub(r'(◎|○|×)', r'<span style="font-size: 13pt; font-family: \'Segoe UI Symbol\';">\1</span>', skill_name)

    # Reverted to original color mixing
    def _mix_colors(self, color1, color2, ratio=0.5):
        """Blends two QColor objects together."""
        qc1 = QColor(color1)
        qc2 = QColor(color2)
        # Added validation check from intermediate step
        if not qc1.isValid() or not qc2.isValid():
             logging.warning(f"Invalid color passed to _mix_colors: {color1}, {color2}")
             return QColor(UMA_TEXT_DARK) # Fallback
        r = int(qc1.red() * (1 - ratio) + qc2.red() * ratio)
        g = int(qc1.green() * (1 - ratio) + qc2.green() * ratio)
        b = int(qc1.blue() * (1 - ratio) + qc2.blue() * ratio)
        return QColor(r, g, b)

    def init_ui(self):
        """Initializes the UI for the detail dialog."""
        # --- Reverted layout/widget structure to original ---
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(15)

        # --- Header Section (Original Structure) ---
        header_widget = QWidget()
        header_layout = QHBoxLayout(header_widget)
        header_layout.setContentsMargins(20, 0, 0, 0)
        header_layout.setSpacing(15)

        left_header_layout = QVBoxLayout()
        left_header_layout.setSpacing(5)
        left_header_layout.setAlignment(Qt.AlignCenter)

        char_image_label = QLabel()
        char_image_label.setFixedSize(100, 100)

        # --- Image Loading/Cropping (Original Structure, with QRectF fix) ---
        runner_name = self.runner_data.get('name', 'Unknown')
        image_name = runner_name.replace(' ', '_')
        image_path = None
        # --- Use path relative to BASE_DIR ---
        profile_img_dir = os.path.join(BASE_DIR, 'assets', 'profile_images')
        if os.path.isdir(profile_img_dir):
            for ext in ['png', 'jpg', 'jpeg']: # Original extensions
                potential_path = os.path.join(profile_img_dir, f'{image_name}.{ext}')
                if os.path.exists(potential_path):
                    image_path = potential_path
                    break
        else:
             logging.warning(f"Profile images directory not found: {profile_img_dir}")

        if image_path:
            try: # Keep try-except block
                image_size = 94
                label_size = 100 # Unused but keep for reference
                source_pixmap = QPixmap(image_path)
                if source_pixmap.isNull(): raise ValueError("Pixmap is null")

                zoom_factor = 1.4 # Original zoom
                scaled_size = source_pixmap.size()
                # Original scaling
                scaled_size.scale(int(image_size * zoom_factor), int(image_size * zoom_factor), Qt.KeepAspectRatioByExpanding)
                scaled_pixmap = source_pixmap.scaled(scaled_size, Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation)

                # Original cropping
                crop_x = (scaled_pixmap.width() - image_size) / 2
                crop_y = 0
                crop_rect = QRect(int(crop_x), int(crop_y), image_size, image_size)
                cropped_pixmap = scaled_pixmap.copy(crop_rect)

                # Original masking
                final_pixmap = QPixmap(image_size, image_size)
                final_pixmap.fill(Qt.transparent)
                painter = QPainter(final_pixmap)
                painter.setRenderHint(QPainter.Antialiasing)
                path = QPainterPath()
                # --- Use QRectF here for potentially smoother circle ---
                path.addEllipse(QRectF(0, 0, image_size, image_size))
                painter.setClipPath(path)
                painter.drawPixmap(0, 0, cropped_pixmap)
                painter.end()

                char_image_label.setPixmap(final_pixmap)
                char_image_label.setAlignment(Qt.AlignCenter)
                # Original stylesheet
                char_image_label.setStyleSheet("background-color: transparent; border: 4px solid #AAAAAA; border-radius: 50px;")
            except Exception as e: # Keep exception handling
                 logging.exception(f"Error processing image for {runner_name}:")
                 char_image_label.setStyleSheet("background-color: #E0E0E0; border-radius: 50px; border: 4px solid #AAAAAA;")
                 char_image_label.setText("?")
                 char_image_label.setAlignment(Qt.AlignCenter)
        else: # Original fallback
            logging.warning(f"Image not found for {runner_name}")
            char_image_label.setStyleSheet("background-color: #E0E0E0; border-radius: 50px; border: 4px solid #AAAAAA;")
            char_image_label.setText("?")
            char_image_label.setAlignment(Qt.AlignCenter)

        left_header_layout.addWidget(char_image_label)

        score_value = self.runner_data.get('score', 0)
        # Original score label formatting/styling
        score_label = QLabel(f"<b>{score_value:,}</b>")
        score_label.setAlignment(Qt.AlignCenter)
        score_label.setStyleSheet("font-size: 14pt; background-color: white; border: 2px solid #C0C0C0; border-radius: 8px; padding: 2px 8px;")
        left_header_layout.addWidget(score_label)

        header_layout.addLayout(left_header_layout)

        # Original right header layout
        right_header_layout = QVBoxLayout()
        right_header_layout.setSpacing(10)
        right_header_layout.setAlignment(Qt.AlignVCenter)

        rank_name_layout = QHBoxLayout()
        rank_name_layout.setSpacing(15)

        # Original Rank Badge structure/styling
        rank_badge_container = QFrame()
        rank_badge_container.setFixedSize(80, 80)
        rank_badge_layout = QVBoxLayout(rank_badge_container)
        rank_badge_layout.setContentsMargins(5,5,5,5)
        rank_badge_layout.setSpacing(0)
        rank_grade = calculateRank(int(score_value))
        badge_color = get_aptitude_grade_color(rank_grade)

        try: # Keep try-except
            base_color = QColor(badge_color if badge_color else "#CCCCCC")
            if not base_color.isValid(): base_color = QColor("#CCCCCC")
            # Original gradient calculation
            brighter_color = base_color.lighter(90).name() # Was 0 -> 100
            darker_color = base_color.darker(70).name()   # Was 6 -> 106
            gradient_style = f"""
                background-color: qlineargradient(
                    x1: 0, y1: 1, x2: 1, y2: 0,
                    stop: 0 {brighter_color}, stop: 0.7 {base_color.name()}, stop: 1 {darker_color}
                );
                border-radius: 40px;
            """
            rank_badge_container.setStyleSheet(gradient_style)
        except Exception as e: # Keep exception handling
             logging.error(f"Error creating rank badge gradient: {e}")
             rank_badge_container.setStyleSheet("background-color: #CCCCCC; border-radius: 40px;")

        # Original Rank labels
        rank_grade_label = OutlineLabel(rank_grade, outline_color=QColor(UMA_TEXT_DARK), outline_width=2, text_color=Qt.white)
        rank_grade_label.setAlignment(Qt.AlignCenter)
        rank_grade_label.setStyleSheet("font-weight: bold; font-size: 28pt; background: transparent; padding: 3px;")
        rank_badge_layout.addWidget(rank_grade_label)
        rank_text_label = OutlineLabel("RANK", outline_color=QColor(UMA_TEXT_DARK), outline_width=1, text_color=Qt.white)
        rank_text_label.setAlignment(Qt.AlignCenter)
        rank_text_label.setStyleSheet("font-weight: bold; background: transparent; margin-top: -8px;")
        rank_badge_layout.addWidget(rank_text_label)

        rank_name_layout.addWidget(rank_badge_container)

        # Original Name label
        name_label = QLabel(f"<b>{runner_name}</b>")
        name_label.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)
        # Original name label style
        name_label.setStyleSheet(f"font-size: 24pt; color: {UMA_TEXT_DARK}; font-weight: bold; padding-left: 40px; letter-spacing: 1px;")
        rank_name_layout.addWidget(name_label)
        rank_name_layout.addStretch()

        right_header_layout.addLayout(rank_name_layout)
        header_layout.addLayout(right_header_layout)
        main_layout.addWidget(header_widget)

        # --- Stats Section (Original Structure/Styling) ---
        stats_container = QFrame()
        stats_container.setObjectName("statsContainer")
        stats_container.setStyleSheet("#statsContainer { border: 2px solid #71d71c; border-radius: 12px; }")
        stats_main_layout = QHBoxLayout(stats_container)
        stats_main_layout.setContentsMargins(0, 0, 0, 0)
        stats_main_layout.setSpacing(0)

        stat_names = ['speed', 'stamina', 'power', 'guts', 'wit']
        # Original icons
        stat_icons = {'speed': '👟', 'stamina': '🤍', 'power': '💪🏻', 'guts': '🔥', 'wit': '🎓'}

        for i, stat in enumerate(stat_names):
            stat_value = self.runner_data.get(stat, 0)
            stat_grade = get_grade_for_stat(stat_value)

            column_container = QWidget()
            column_container.setFixedWidth(125) # Original fixed width
            column_layout = QVBoxLayout(column_container)
            column_layout.setContentsMargins(0, 0, 0, 0)
            column_layout.setSpacing(0)

            # Original border/radius logic
            border_style = "border-right: 2px dashed #A5D6A7;" if i < len(stat_names) - 1 else ""
            header_radius_style = ""
            if i == 0: header_radius_style = "border-top-left-radius: 10px;"
            elif i == len(stat_names) - 1: header_radius_style = "border-top-right-radius: 10px;"
            content_radius_style = ""
            if i == 0: content_radius_style = "border-bottom-left-radius: 12px;"
            elif i == len(stat_names) - 1: content_radius_style = "border-bottom-right-radius: 12px;"

            # Original header label
            header_label = OutlineLabel(f"{stat_icons.get(stat, '')} {stat.title()}", outline_color=QColor('#fefefe'), outline_width=0.5, text_color=Qt.white)
            header_label.setAlignment(Qt.AlignHCenter | Qt.AlignVCenter)
            header_label.setStyleSheet(f"background-color: #71d71c; font-size: 14pt; {header_radius_style} padding: 3px; letter-spacing: 1px;")
            column_layout.addWidget(header_label)

            # Original content widget/layout
            content_widget = QWidget()
            content_layout = QHBoxLayout(content_widget)
            content_layout.setContentsMargins(0, 0, 0, 0) # MODIFIED: Changed margins
            content_layout.setSpacing(0) # MODIFIED: Changed spacing
            content_widget.setStyleSheet(f"background-color: white; {content_radius_style} {border_style}")

            # Original grade/value labels and styling
            grade_text_color = get_aptitude_grade_color(stat_grade) if get_aptitude_grade_color(stat_grade) else UMA_TEXT_DARK
            mixed_outline_color = self._mix_colors(grade_text_color, UMA_TEXT_DARK, ratio=0.7)
            base_qcolor = QColor(grade_text_color)
            top_color = base_qcolor.lighter(100).name()
            bottom_color = base_qcolor.darker(73).name() # Reverted darker value

            grade_label = OutlineLabel(stat_grade, outline_color=mixed_outline_color, outline_width=2, text_color=base_qcolor, force_left_align=True) # Original force_left_align
            grade_label.setTextGradient(top_color, bottom_color)
            grade_label.setFixedWidth(56)
            grade_label.setAlignment(Qt.AlignCenter) # Original alignment
            grade_label.setStyleSheet("font-weight: bold; font-size: 25pt; background-color: transparent; border: none; padding: 3px; letter-spacing: -4px;")

            value_label = QLabel(str(stat_value))
            value_label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
            value_label.setStyleSheet("font-weight: bold; font-size: 17pt; letter-spacing: 1px; background-color: transparent; border: none; padding-right: 5px;")

            content_layout.addWidget(grade_label, 0) # MODIFIED: Added stretch factor
            # MODIFIED: Removed content_layout.addStretch(1)
            content_layout.addWidget(value_label, 1) # MODIFIED: Added stretch factor
            column_layout.addWidget(content_widget)
            stats_main_layout.addWidget(column_container)

        main_layout.addWidget(stats_container)


        # --- Aptitude Section ---
        # MODIFIED: Replaced entire aptitude section with the one from the 'different' version
        aptitude_widget = QWidget()
        aptitude_layout = QGridLayout(aptitude_widget)
        aptitude_layout.setContentsMargins(9, 10, 9, 10) # Equal left/right margins
        aptitude_layout.setHorizontalSpacing(10) # Horizontal spacing between buttons
        aptitude_layout.setVerticalSpacing(15) # Vertical spacing between rows

        aptitude_types = ['track', 'distance', 'style']
        aptitude_details = {'track': ['turf', 'dirt'], 'distance': ['sprint', 'mile', 'medium', 'long'], 'style': ['front', 'pace', 'late', 'end']}

        for row_idx, apt_type in enumerate(aptitude_types):
            apt_type_label = QLabel(f"<b>{apt_type.title()}</b>")
            apt_type_label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
            apt_type_label.setFixedWidth(70)
            aptitude_layout.addWidget(apt_type_label, row_idx, 0)

            for col_idx, detail in enumerate(aptitude_details[apt_type]):
                apt_value = self.runner_data.get(f"rank_{detail}", 'N/A').upper()
                display_name = detail.title()

                apt_button = QWidget()
                # apt_button.setFixedWidth(120) # Remove fixed width
                apt_button.setStyleSheet("font-weight: bold; font-size: 12pt; background-color: #FFFFFF; border: 2px solid #D0D0D0; border-radius: 10px;")
                apt_button_layout = QHBoxLayout(apt_button)
                apt_button_layout.setContentsMargins(8, 5, 8, 5) # Adjusted margins
                apt_button_layout.setSpacing(5)

                detail_label = OutlineLabel(display_name, outline_color=Qt.white, outline_width=1, text_color=QColor(UMA_TEXT_DARK))
                detail_label.setStyleSheet("border: none; font-size: 14pt;") # Slightly smaller font
                detail_label.setAlignment(Qt.AlignCenter)
                detail_label.setFixedWidth(72)
                apt_button_layout.addWidget(detail_label, 1) # Give stretch

                grade_color = get_aptitude_grade_color(apt_value) if get_aptitude_grade_color(apt_value) else "#888888" # Fallback grey
                mixed_outline_color = self._mix_colors(grade_color, UMA_TEXT_DARK, ratio=0.7)
                base_qcolor = QColor(grade_color)
                top_color = base_qcolor.lighter(100).name()
                bottom_color = base_qcolor.darker(73).name() # Darker bottom

                grade_label = OutlineLabel(apt_value, outline_color=mixed_outline_color, outline_width=2, text_color=base_qcolor)
                grade_label.setTextGradient(top_color, bottom_color)
                grade_label.setAlignment(Qt.AlignCenter)
                # Centered padding, min width
                grade_label.setStyleSheet(f"font-weight: bold; font-size: 19pt; border: none; padding: 3px 0px; min-width: 30px;")
                apt_button_layout.addWidget(grade_label, 0) # No stretch
                aptitude_layout.addWidget(apt_button, row_idx, col_idx + 1)

        # Set stretch factors for columns
        max_cols = max(len(v) for v in aptitude_details.values())
        aptitude_layout.setColumnStretch(0, 0) # Label column no stretch
        for i in range(1, max_cols + 1):
            aptitude_layout.setColumnStretch(i, 1) # Equal stretch for button columns
        aptitude_layout.setColumnStretch(max_cols + 1, 10) # Add stretch after last button column


        main_layout.addWidget(aptitude_widget)

        # --- Skills Section ---
        skills_section_widget = QWidget()
        skills_section_layout = QVBoxLayout(skills_section_widget)
        skills_section_layout.setContentsMargins(0, 0, 2, 3)
        skills_section_layout.setSpacing(0)

        skills_title_label = OutlineLabel("Skills", outline_color=QColor(UMA_TEXT_DARK), outline_width=1, text_color=UMA_TEXT_LIGHT)
        skills_title_label.setAlignment(Qt.AlignCenter)
        skills_title_label.setStyleSheet("font-weight: bold; font-size: 13pt; background-color: #71d71c; border-top-left-radius: 5px; border-top-right-radius: 5px; border-bottom-left-radius: 0px; border-bottom-right-radius: 0px; padding: 3px; letter-spacing: 1px;")
        skills_section_layout.addWidget(skills_title_label)
        # Apply border/radius to the container widget itself
        skills_section_widget.setStyleSheet("#skillsSectionWidget { border: 2px solid #71d71c; border-radius: 5px; background-color: transparent; }")
        skills_section_widget.setObjectName("skillsSectionWidget")


        scroll_area = QScrollArea()
        scroll_area.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOn)
        scroll_area.setWidgetResizable(True)
        # --- Make scroll step smaller ---
        scroll_area.verticalScrollBar().setSingleStep(5) # Pixels per wheel tick
        # Style scroll area - transparent bg, no border (border is on container now)
        scroll_area.setStyleSheet("""
            QScrollArea { background-color: transparent; border: none; }
            QWidget#scrollWidget { background-color: transparent; } /* Ensure inner widget is transparent */
        """)

        scroll_widget = QWidget()
        scroll_widget.setObjectName("scrollWidget") # Set object name for styling
        skills_layout = QGridLayout(scroll_widget)
        skills_layout.setSpacing(8) # Spacing between skill items
        skills_layout.setContentsMargins(15, 10, 15, 10) # Margins inside scroll area (reduced top/bottom)

        skills_str = self.runner_data.get('skills', '')
        skills = []
        if skills_str and isinstance(skills_str, str):
            skills = [s.strip() for s in skills_str.split('|') if s.strip()] # Filter empty strings

        if skills:
            n = len(skills)
            # Try to balance columns better, especially for odd numbers
            mid = (n + 1) // 2

            # This loop populates the two-column skill list.
            for i, skill in enumerate(skills):
                skill_container = QFrame() # Use QFrame for easier styling
                skill_container.setFrameShape(QFrame.StyledPanel) # Give it a default panel shape
                skill_layout = QHBoxLayout(skill_container)
                skill_layout.setContentsMargins(8, 5, 10, 5) # Internal padding
                skill_layout.setSpacing(8) # Spacing between icon and text

                # Get the skill type to display the correct icon.
                skill_type = self.skill_types.get(skill) if self.skill_types else None
                icon_label = QLabel()
                icon_label.setFixedSize(32, 32)
                icon_label.setStyleSheet("border: none; background: transparent;") # Ensure transparent background

                if skill_type:
                    icon_path = os.path.join(BASE_DIR, 'assets', 'skill_icons', f'{skill_type}.png')
                    if os.path.exists(icon_path):
                        pixmap = QPixmap(icon_path)
                        if not pixmap.isNull():
                             icon_label.setPixmap(pixmap.scaled(32, 32, Qt.KeepAspectRatio, Qt.SmoothTransformation))
                        else:
                             logging.warning(f"Failed to load skill icon (pixmap is null): {icon_path}")
                    # else:
                    #      logging.debug(f"Skill icon not found: {icon_path}")

                skill_layout.addWidget(icon_label)

                formatted_skill_name = self._format_skill_name_with_symbols(skill)
                skill_label = QLabel(formatted_skill_name)
                # Ensure label doesn't inherit container styles that break text
                skill_label.setStyleSheet(f"QLabel {{ font-weight: bold; background-color: transparent; color: {UMA_TEXT_DARK}; border: none; padding: 0; margin: 0; line-height: 20%; }}")
                skill_label.setTextFormat(Qt.RichText) # Use RichText for the formatted symbols
                skill_label.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)
                skill_label.setWordWrap(True)
                skill_label.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Preferred) # Allow horizontal expansion


                skill_layout.addWidget(skill_label, 1) # Give label stretch factor 1
                skill_container.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed) # Expand horizontally, fixed vertically
                skill_container.setFixedHeight(56)


                # Dynamically style the skill container based on its type (unique, gold, etc.).
                container_style = ""
                default_border = "border: 2px solid #C0C0C0; border-radius: 10px;"
                # Unique skill (assuming first skill is unique if type starts with 'unique')
                if skill_type and skill_type.startswith('unique') and i == 0:
                    rainbow_bg = "qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #F9E08B, stop:0.35 #C4FFC8, stop:0.65 #B8ECFF, stop:1 #F6BFFF);"
                    rainbow_border = "border: 2px solid #A0A0A0; border-radius: 10px;" # Slightly darker border
                    container_style = f"QFrame {{ background: {rainbow_bg} {rainbow_border} }}"
                # Gold skill (assuming type ends with 'g')
                elif skill_type and skill_type.endswith('g'):
                    gold_bg = "qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #FFEA8A, stop:1 #FFC24A);"
                    gold_border = "border: 2px solid #E6A245; border-radius: 10px;"
                    container_style = f"QFrame {{ background: {gold_bg} {gold_border} }}"
                # Default skill style
                else:
                    default_bg = "#F5F5F5;"
                    container_style = f"QFrame {{ background-color: {default_bg} {default_border} }}"

                skill_container.setStyleSheet(container_style)

                # Add the skill to the grid layout.
                row, col = (i, 0) if i < mid else (i - mid, 1)
                skills_layout.addWidget(skill_container, row, col)

            # Ensure columns have equal width
            skills_layout.setColumnStretch(0, 1)
            skills_layout.setColumnStretch(1, 1)
             # Add stretch to the row after the last skill item
            last_row_index = max(mid - 1, n - mid -1) # Calculate the last row index used
            skills_layout.setRowStretch(last_row_index + 1, 1)

        else: # No skills found
            no_skills_label = QLabel("No skills listed.")
            no_skills_label.setAlignment(Qt.AlignCenter)
            no_skills_label.setStyleSheet("background-color: transparent; border: none; color: #888;") # Style for emphasis
            skills_layout.addWidget(no_skills_label, 0, 0, 1, 2) # Span across both columns
            skills_layout.setRowStretch(1, 1) # Add stretch below the label


        scroll_area.setWidget(scroll_widget) # Set the widget containing the grid layout
        skills_section_layout.addWidget(scroll_area) # Add scroll area to the section layout
        main_layout.addWidget(skills_section_widget, 1) # Give skills section vertical stretch factor


# --- __main__ section reverted to original (keeping AppUserModelID logic) ---
if __name__ == "__main__":
    app = QApplication.instance() # Check if already exists
    if not app:
        app = QApplication(sys.argv)

    # Set AppUserModelID for Windows taskbar icon grouping
    my_app_id = 'umascanner.zeek.211025' # Reverted ID format
    try:
        if os.name == 'nt':
             ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(my_app_id)
    except AttributeError:
        logging.warning("Could not set AppUserModelID (might not be on Windows or shell32 not available).")
        pass # Keep original pass
    except Exception as e:
         logging.error(f"Error setting AppUserModelID: {e}")
         pass # Keep original pass


    # Set application icon (original logic)
    icon_path_png = os.path.join(BASE_DIR, 'assets', 'icon.png')
    icon_path_jpg = os.path.join(BASE_DIR, 'assets', 'icon.jpg') # Added check for jpg
    if os.path.exists(icon_path_png):
         app.setWindowIcon(QIcon(icon_path_png))
    elif os.path.exists(icon_path_jpg):
         app.setWindowIcon(QIcon(icon_path_jpg))
    else:
        logging.warning("Application icon (icon.png or icon.jpg) not found.")


    # Set default font (original size)
    app.setFont(QFont("Segoe UI", 12))

    # Apply global stylesheet (original combination)
    combined_qss = ""
    try: combined_qss += QSS_DETAIL_DIALOG
    except NameError: logging.error("QSS_DETAIL_DIALOG style not defined.")
    try: combined_qss += QSS
    except NameError: logging.error("QSS style not defined.")
    if not combined_qss: logging.warning("Applying empty stylesheet.")
    app.setStyleSheet(combined_qss)

    try: # Keep try-except around main window creation
        main_window = UmaAnalyzerPyQt()
        main_window.showMaximized()
        sys.exit(app.exec_())
    except Exception as e:
         logging.exception("Unhandled exception during application startup or execution:")
         QMessageBox.critical(None, "Fatal Error", f"An unexpected error occurred:\n{e}\n\nPlease check app.log for details.")
         sys.exit(1)