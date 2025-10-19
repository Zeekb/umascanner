import sys
import pandas as pd
import json
import os
import re
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
    QTabWidget, QTableWidget, QTableWidgetItem, QDockWidget, QLabel, 
    QComboBox, QLineEdit, QCheckBox, QSlider, QHeaderView, QPushButton, 
    QStyledItemDelegate, QStyle, QFrame, QDialog, QScrollArea, QGroupBox, QVBoxLayout, QHBoxLayout, QGridLayout, QRadioButton
)
from PyQt5.QtGui import QColor, QTextDocument, QFont, QPixmap, QPainter, QPainterPath
from PyQt5.QtCore import Qt, QRect

# --- Path Configuration ---
# The absolute path to the project's root directory.
# This is used to construct absolute paths to other directories in the project.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# --- Umamusume Themed Colors ---
UMA_LIGHT_BG = "#FFF8E1"  # Very light cream/yellow
UMA_MEDIUM_BG = "#FFECB3" # Light pastel yellow
UMA_DARK_BG = "#FFD54F"   # Richer yellow/gold
UMA_ACCENT_PINK = "#FF80AB" # Vibrant pink
UMA_ACCENT_BLUE = "#82B1FF" # Sky blue
UMA_TEXT_DARK = "#424242" # Dark grey
UMA_TEXT_LIGHT = "#FFFFFF" # White

# --- Qt Style Sheet (QSS) for Umamusume Theme ---
QSS = f"""
QMainWindow {{
    background-color: {UMA_LIGHT_BG};
}}

QDockWidget {{
    background-color: {UMA_MEDIUM_BG};
    border: 1px solid {UMA_DARK_BG};
    titlebar-close-icon: url(close.png); /* Placeholder for custom icon */
    titlebar-normal-icon: url(normal.png); /* Placeholder for custom icon */
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

QComboBox, QLineEdit, QPushButton, QCheckBox {{
    background-color: {UMA_TEXT_LIGHT};
    border: 1px solid {UMA_DARK_BG};
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
"""

QSS_DETAIL_DIALOG = f"""
QDialog {{
    background-color: {UMA_LIGHT_BG};
}}

QGroupBox {{
    background-color: {UMA_MEDIUM_BG};
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
    background-color: {UMA_DARK_BG};
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
        self.setWindowTitle("Uma Musume Runner Analyzer (PyQt)")
        self.setGeometry(100, 100, 1800, 1000)

        self.data = self.load_data()
        self.spark_info = self.load_spark_designations()
        self.racers = self.load_racers()
        self.open_dialogs = []

        if self.data is None or self.spark_info is None or self.racers is None:
            sys.exit(1)

        # --- Themed stat colors ---
        self.stat_colors = {
            (0, 100): '#F8F8F8',    # Very Light Grey
            (100, 200): '#E0F7FA',  # Light Cyan
            (200, 300): '#E8EAF6',  # Light Indigo
            (300, 400): '#BBDEFB',  # Light Blue
            (400, 600): '#C8E6C9',  # Light Green
            (600, 800): '#FFCDD2',  # Light Red/Pink
            (800, 1000): '#FFECB3', # Light Orange/Yellow
            (1000, 1201): '#FFF9C4' # Lighter Yellow
        }

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

    def load_racers(self):
        if self.data is None:
            return [''] # Return empty list if data loading failed
        
        # Get unique names from the 'name' column of the dataframe
        unique_names = sorted(self.data['name'].unique())
        
        # Return the list with an empty string at the beginning for the "all" option
        return [''] + unique_names

    def _remove_dialog_from_list(self, dialog_to_remove):
        try:
            self.open_dialogs.remove(dialog_to_remove)
        except ValueError:
            pass


    def show_runner_details(self, row, column):
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
        
        dialog = UmaDetailDialog(runner_data, self.spark_info, self)
        self.open_dialogs.append(dialog)
        dialog.finished.connect(lambda: self._remove_dialog_from_list(dialog))
        dialog.show()


    def init_ui(self):
        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        self.layout = QHBoxLayout(self.central_widget)

        self.controls_dock = QDockWidget("Filters and Controls", self)
        self.addDockWidget(Qt.LeftDockWidgetArea, self.controls_dock)
        self.controls_widget = QWidget()
        self.controls_widget.setMinimumWidth(200) # Set a minimum width for the controls widget
        self.controls_layout = QVBoxLayout(self.controls_widget)
        self.controls_dock.setWidget(self.controls_widget)

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
        
        self.controls_layout.addStretch()

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
                    color = self.get_color_for_value(cell_value)
                    if color: item.setBackground(color)
                
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
        
    def get_color_for_value(self, value):
        if not isinstance(value, (int, float)):
            return None
        for (min_val, max_val), color in self.stat_colors.items():
            if min_val <= value < max_val:
                return QColor(color)
        return None


class UmaDetailDialog(QDialog):
    def __init__(self, runner_data, spark_info, parent=None):
        super().__init__(parent)
        self.setWindowTitle(f"Umamusume Details: {runner_data['name']}")
        self.setGeometry(200, 200, 600, 800)
        self.runner_data = runner_data
        self.spark_info = spark_info
        self.setStyleSheet(QSS_DETAIL_DIALOG)
        self.init_ui()

    def get_grade_for_stat(self, value):
        if value == 1200: return 'SS+'
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

    def get_color_for_grade(self, grade):
        grade_colors = {
            'SS+': '#FFD700',
            'SS': '#FFD700',
            'S+': '#FFD700',
            'S': '#FFD54F',
            'A+': '#FFDAB9',
            'A': '#FFDAB9',
            'B+': '#FFCDD2',
            'B': '#FFCDD2',
            'C+': '#C8E6C9',
            'C': '#C8E6C9',
            'D+': '#BBDEFB',
            'D': '#BBDEFB',
            'E+': '#E8EAF6',
            'E': '#E8EAF6',
            'F+': '#E0F7FA',
            'F': '#E0F7FA',
            'G': '#F8F8F8',
            'N/A': '#F8F8F8'
        }
        return grade_colors.get(grade, '#696969')

    def get_aptitude_grade_color(self, grade):
        grade_colors = {
            'S': '#FFB74D',  # Orange
            'A': '#E57373',  # Red
            'B': '#FF80AB',  # Pink
            'C': '#81C784',  # Green
            'D': '#64B5F6',  # Blue
            'E': '#9575CD',  # Purple
            'F': '#7986CB',  # Indigo
            'G': '#9E9E9E'   # Darker Grey
        }
        base_grade = grade.rstrip('+')
        return grade_colors.get(base_grade, '#424242')

    def init_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(15)

        # --- Header Section ---
        header_widget = QWidget()
        header_layout = QHBoxLayout(header_widget)
        header_layout.setContentsMargins(0, 0, 0, 0)
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
            zoom_factor = 1.4
            
            # Scale source to be zoom_factor bigger than the target image_size
            scaled_size = source_pixmap.size()
            scaled_size.scale(int(image_size * zoom_factor), int(image_size * zoom_factor), Qt.KeepAspectRatioByExpanding)
            scaled_pixmap = source_pixmap.scaled(scaled_size, Qt.KeepAspectRatioByExpanding, Qt.SmoothTransformation)

            # Define the crop rectangle (94x94) from the zoomed pixmap
            crop_x = (scaled_pixmap.width() - image_size) / 2
            crop_y = 0 # Focus on top-center
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
            char_image_label.setStyleSheet("background-color: transparent; border: 4px solid #FFD700; border-radius: 50px;")
        else:
            char_image_label.setStyleSheet("background-color: #E0E0E0; border-radius: 50px; border: 4px solid #FFD700;")
        
        left_header_layout.addWidget(char_image_label)

        score_label = QLabel(f"<b>{self.runner_data['score']:,}</b>")
        score_label.setAlignment(Qt.AlignCenter)
        score_label.setStyleSheet("font-size: 16pt;")
        left_header_layout.addWidget(score_label)
        
        header_layout.addLayout(left_header_layout)

        # Right side: Rank and Name
        right_header_layout = QVBoxLayout()
        right_header_layout.setSpacing(10)
        right_header_layout.setAlignment(Qt.AlignVCenter)

        rank_name_layout = QHBoxLayout()
        rank_name_layout.setSpacing(15)
        
        rank_vbox = QVBoxLayout()
        rank_vbox.setSpacing(0)
        rank_vbox.setAlignment(Qt.AlignCenter)
        rank_grade = calculateRank(int(self.runner_data['score']))
        rank_grade_label = QLabel(rank_grade)
        rank_grade_label.setAlignment(Qt.AlignCenter)
        rank_grade_label.setStyleSheet(f"font-weight: bold; font-size: 22pt; color: {self.get_aptitude_grade_color(rank_grade)};")
        rank_vbox.addWidget(rank_grade_label)
        rank_text_label = QLabel("RANK")
        rank_text_label.setAlignment(Qt.AlignCenter)
        rank_text_label.setStyleSheet("font-weight: bold;")
        rank_vbox.addWidget(rank_text_label)
        rank_name_layout.addLayout(rank_vbox)

        name_label = QLabel(f"<font size='6'><b>{self.runner_data['name']}</b></font>")
        name_label.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)
        rank_name_layout.addWidget(name_label)
        rank_name_layout.addStretch()
        
        right_header_layout.addLayout(rank_name_layout)
        
        header_layout.addLayout(right_header_layout)
        main_layout.addWidget(header_widget)

        # --- Stats Section ---
        stats_group_box = QGroupBox()
        stats_group_box.setStyleSheet("background-color: #E8F5E9; border-radius: 10px; padding-top: 5px; padding-bottom: 5px;")
        stats_layout = QGridLayout(stats_group_box)
        stats_layout.setContentsMargins(10, 5, 10, 5)
        stats_layout.setHorizontalSpacing(10)
        stats_layout.setVerticalSpacing(2)
        
        stat_names = ['speed', 'stamina', 'power', 'guts', 'wit']
        stat_icons = {
            'speed': '👟', 'stamina': '🤍', 'power': '💪🏻', 'guts': '🔥', 'wit': '🎓'
        }

        for i, stat in enumerate(stat_names):
            stat_value = self.runner_data.get(stat, 0)
            stat_grade = self.get_grade_for_stat(stat_value)

            stat_label_layout = QHBoxLayout()
            stat_label_layout.addStretch()
            stat_label_layout.addWidget(QLabel(stat_icons.get(stat, '')))
            stat_label_layout.addWidget(QLabel(stat.title()))
            stat_label_layout.addStretch()
            stats_layout.addLayout(stat_label_layout, 0, i)

            value_grade_layout = QHBoxLayout()
            value_grade_layout.setSpacing(5)
            value_grade_layout.addStretch()

            grade_label = QLabel(stat_grade)
            grade_label.setMinimumWidth(40)
            grade_label.setAlignment(Qt.AlignCenter)
            grade_label.setStyleSheet(f"background-color: {self.get_color_for_grade(stat_grade)}; color: #000000; padding: 3px; border-radius: 8px; font-weight: bold; font-size: 12pt;")
            value_grade_layout.addWidget(grade_label)

            value_label = QLabel(str(stat_value))
            value_label.setStyleSheet("font-weight: bold; font-size: 12pt;")
            value_grade_layout.addWidget(value_label)
            
            value_grade_layout.addStretch()
            stats_layout.addLayout(value_grade_layout, 1, i)
        main_layout.addWidget(stats_group_box)

        # --- Aptitude Section ---
        aptitude_widget = QWidget()
        aptitude_layout = QGridLayout(aptitude_widget)
        aptitude_layout.setContentsMargins(10, 10, 10, 10)
        aptitude_layout.setSpacing(10)
        aptitude_layout.setVerticalSpacing(15)

        aptitude_types = ['track', 'distance', 'style']
        aptitude_details = {
            'track': ['turf', 'dirt'],
            'distance': ['sprint', 'mile', 'medium', 'long'],
            'style': ['front', 'pace', 'late', 'end']
        }

        for row_idx, apt_type in enumerate(aptitude_types):
            apt_type_label = QLabel(f"<b>{apt_type.title()}</b>")
            apt_type_label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)
            aptitude_layout.addWidget(apt_type_label, row_idx, 0)

            details = aptitude_details[apt_type]
            for col_idx, detail in enumerate(details):
                apt_key = f"rank_{detail}"
                apt_value = self.runner_data.get(apt_key, 'N/A').upper()

                apt_button = QWidget()
                apt_button.setStyleSheet("font-weight: bold; font-size: 12pt; background-color: #FFFFFF; border: 1px solid #D0D0D0; border-radius: 8px;")
                
                apt_button_layout = QHBoxLayout(apt_button)
                apt_button_layout.setContentsMargins(8, 3, 8, 3)
                apt_button_layout.setSpacing(5)

                detail_label = QLabel(detail.title())
                apt_button_layout.addWidget(detail_label)

                grade_label = QLabel(apt_value)
                grade_color = self.get_aptitude_grade_color(apt_value)
                grade_label.setStyleSheet(f"color: {grade_color}; font-weight: bold; font-size: 15pt;")
                apt_button_layout.setAlignment(Qt.AlignLeft | Qt.AlignRight)
                apt_button_layout.addWidget(grade_label)

                aptitude_layout.addWidget(apt_button, row_idx, col_idx + 1)
        
        max_cols = max(len(v) for v in aptitude_details.values())
        aptitude_layout.setColumnStretch(max_cols + 1, 1)

        main_layout.addWidget(aptitude_widget)

        # --- Skills Section ---
        skills_group_box = QGroupBox("Skills")
        skills_group_box_layout = QVBoxLayout(skills_group_box)
        skills_group_box_layout.setContentsMargins(10, 20, 10, 10)
        skills_group_box_layout.setSpacing(5)

        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setStyleSheet("background-color: transparent; border: none;")

        scroll_widget = QWidget()
        skills_layout = QGridLayout(scroll_widget)  # use grid layout for 2 columns
        skills_layout.setSpacing(5)

        skills_str = self.runner_data.get('skills', '')
        if skills_str:
            skills = [s.strip() for s in skills_str.split('|')]
            
            # Determine how many items go in the first column
            n = len(skills)
            mid = (n + 1) // 2  # ensures first column gets the extra item if odd
            
            for i, skill in enumerate(skills):
                skill_button = QPushButton(skill)
                skill_button.setStyleSheet(
                    f"background-color: {UMA_ACCENT_BLUE}; color: {UMA_TEXT_LIGHT}; border-radius: 10px; padding: 5px 10px;"
                )
                # Determine row and column
                if i < mid:
                    row = i
                    col = 0
                else:
                    row = i - mid
                    col = 1
                skills_layout.addWidget(skill_button, row, col)
        else:
            skills_layout.addWidget(QLabel("No skills listed."), 0, 0)

        # Add stretch to bottom of both columns
        skills_layout.setRowStretch((len(skills) + 1) // 2, 1)

        scroll_area.setWidget(scroll_widget)
        skills_group_box_layout.addWidget(scroll_area)
        main_layout.addWidget(skills_group_box)



        # --- Close Button ---
        close_button = QPushButton("Close")
        close_button.clicked.connect(self.accept)
        main_layout.addWidget(close_button)


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
    app.setFont(QFont("Calibri", 12)) # Consider a more thematic font if available
    app.setStyleSheet(QSS) # Apply the custom QSS
    main_window = UmaAnalyzerPyQt()
    main_window.show()
    sys.exit(app.exec_())

