import sys
import pandas as pd
import json
import os
from PyQt5.QtWidgets import (
    QApplication, QDialog, QWidget, QVBoxLayout, QHBoxLayout, 
    QLabel, QPushButton, QGroupBox, QGridLayout, QCheckBox, QSizePolicy,
    QButtonGroup
)
from PyQt5.QtGui import QFont
from PyQt5.QtCore import Qt
from datetime import datetime

# --- Path Configuration ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# --- Themed Colors and Styles ---
UMA_LIGHT_BG = "#FFF8E1"
UMA_MEDIUM_BG = "#FFECB3"
UMA_DARK_BG = "#FFD54F"
UMA_ACCENT_PINK = "#FF80AB"
UMA_ACCENT_BLUE = "#82B1FF"
UMA_TEXT_DARK = "#424242"
UMA_TEXT_LIGHT = "#FFFFFF"

QSS = f"""
QDialog {{
    background-color: {UMA_LIGHT_BG};
}}
QGroupBox {{
    background-color: {UMA_MEDIUM_BG};
    border: 1px solid {UMA_DARK_BG};
    border-radius: 5px;
    margin-top: 1ex;
    font-weight: bold;
    color: {UMA_TEXT_DARK};
}}
QGroupBox::title {{
    subcontrol-origin: margin;
    subcontrol-position: top center;
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

def clear_layout(layout):
    if layout is not None:
        while layout.count():
            item = layout.takeAt(0)
            widget = item.widget()
            if widget is not None:
                widget.setParent(None)
            else:
                clear_layout(item.layout())

class ConflictResolutionDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Conflict Resolution")
        self.setGeometry(100, 100, 1600, 800)
        
        self.conflicts = []
        self.current_conflict_index = 0
        self.spark_choice_widgets = {}
        self.load_conflicts()
        
        self.init_ui()
        if self.conflicts:
            self.display_conflict(self.current_conflict_index)
        else:
            self.info_label.setText("No conflicts found.")
            self.save_button.setEnabled(False)

    def load_conflicts(self):
        self.conflicts_file = os.path.join(BASE_DIR, 'data', 'conflicts.json')
        if os.path.exists(self.conflicts_file):
            with open(self.conflicts_file, 'r') as f:
                try:
                    self.conflicts = json.load(f)
                except json.JSONDecodeError:
                    self.conflicts = []

    def init_ui(self):
        main_layout = QVBoxLayout(self)
        self.info_label = QLabel()
        self.info_label.setSizePolicy(QSizePolicy.Preferred, QSizePolicy.Fixed)
        main_layout.addWidget(self.info_label)

        basic_info_group = QGroupBox("Basic Info")
        self.basic_info_layout = QGridLayout(basic_info_group)
        main_layout.addWidget(basic_info_group)

        key_group = QGroupBox("Color Key")
        key_layout = QHBoxLayout(key_group)
        key_layout.addWidget(QLabel('<font color="black">Black: Unchanged</font>'))
        key_layout.addWidget(QLabel('<font color="green">Green: New Spark</font>'))
        key_layout.addWidget(QLabel('<font color="red">Red: Spark Not Present in New</font>'))
        key_layout.addWidget(QLabel('<font color="blue">Blue: Count Changed</font>'))
        key_layout.addStretch()
        main_layout.addWidget(key_group)
        
        self.sparks_group = QGroupBox("Sparks")
        self.sparks_layout = QGridLayout(self.sparks_group)
        main_layout.addWidget(self.sparks_group)



        button_layout = QHBoxLayout()
        button_layout.addStretch()
        self.save_button = QPushButton("Save and Resolve Next")
        self.save_button.clicked.connect(self.save_resolution)
        button_layout.addWidget(self.save_button)
        main_layout.addLayout(button_layout)

    # In conflict_resolver.py, function format_and_diff_sparks
    def format_and_diff_sparks(self, existing_sparks_data, new_sparks_data):
        def parse_sparks(sparks_data):
            if not sparks_data: return {}
            try:
                sparks_list = json.loads(sparks_data) if isinstance(sparks_data, str) else sparks_data
                # The key is now just the spark's origin (type)
                # The value is a list of sparks for that origin
                parsed = {"parent": [], "grandparent_1": [], "grandparent_2": []}
                for s in sparks_list:
                    if s['type'] in parsed:
                        parsed[s['type']].append(s)
                return parsed
            except (json.JSONDecodeError, TypeError): return {}

        existing_sparks = parse_sparks(existing_sparks_data)
        new_sparks = parse_sparks(new_sparks_data)
        
        diff_results = {}
        
        # Iterate through the three main types
        for spark_type in ["parent", "grandparent_1", "grandparent_2"]:
            existing_map = {(s['color'], s['spark_name']): s['count'] for s in existing_sparks.get(spark_type, [])}
            new_map = {(s['color'], s['spark_name']): s['count'] for s in new_sparks.get(spark_type, [])}
            all_spark_keys = sorted(list(set(existing_map.keys()) | set(new_map.keys())))
            
            diff_results[spark_type] = {'existing': [], 'new': []}

            for color, name in all_spark_keys:
                existing_count = existing_map.get((color, name))
                new_count = new_map.get((color, name))
                
                # This diffing logic remains largely the same
                if existing_count is not None and new_count is not None:
                    if existing_count == new_count:
                        diff_results[spark_type]['existing'].append(f'<font color="black">{name} {existing_count}*</font>')
                        diff_results[spark_type]['new'].append(f'<font color="black">{name} {new_count}*</font>')
                    else:
                        diff_results[spark_type]['existing'].append(f'<font color="blue">{name} {existing_count}*</font>')
                        diff_results[spark_type]['new'].append(f'<font color="blue">{name} {new_count}*</font>')
                elif existing_count is not None:
                    diff_results[spark_type]['existing'].append(f'<font color="red">{name} {existing_count}*</font>')
                elif new_count is not None:
                    diff_results[spark_type]['new'].append(f'<font color="green">{name} {new_count}*</font>')

        return diff_results

    def display_conflict(self, index):
        clear_layout(self.basic_info_layout)
        clear_layout(self.sparks_layout)

        self.current_conflict_index = index
        self.info_label.setText(f"Conflict {index + 1} of {len(self.conflicts)}")

        conflict = self.conflicts[index]
        existing_data = conflict['existing']
        new_data = conflict['new']

        self.basic_info_layout.addWidget(QLabel("<b>Field</b>"), 0, 0)
        self.basic_info_layout.addWidget(QLabel("<b>Existing</b>"), 0, 1)
        self.basic_info_layout.addWidget(QLabel("<b>New</b>"), 0, 2)
        info_fields = ['name', 'score', 'stats', 'last_updated']
        for i, field in enumerate(info_fields):
            self.basic_info_layout.addWidget(QLabel(f"{field.title()}:"), i + 1, 0)
            if field == 'stats':
                existing_val = ", ".join([str(existing_data.get(s, '')) for s in ['speed', 'stamina', 'power', 'guts', 'wit']])
                new_val = ", ".join([str(new_data.get(s, '')) for s in ['speed', 'stamina', 'power', 'guts', 'wit']])
            else:
                existing_val, new_val = existing_data.get(field, ''), new_data.get(field, '')
            if field == 'last_updated':
                try: existing_val = datetime.strptime(existing_val, "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d %I:%M %p")
                except (ValueError, TypeError): pass
                try: new_val = datetime.strptime(new_val, "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d %I:%M %p")
                except (ValueError, TypeError): pass
            self.basic_info_layout.addWidget(QLabel(str(existing_val)), i + 1, 1)
            self.basic_info_layout.addWidget(QLabel(str(new_val)), i + 1, 2)

        self.spark_choice_widgets = {}
        self.sparks_layout.addWidget(QLabel("<b>Category</b>"), 0, 0)
        self.sparks_layout.addWidget(QLabel("<b>Existing</b>"), 0, 1)
        self.sparks_layout.addWidget(QLabel("<b>New</b>"), 0, 2)
        self.sparks_layout.setColumnStretch(1, 1)
        self.sparks_layout.setColumnStretch(2, 1)

        diff_results = self.format_and_diff_sparks(existing_data.get('sparks'), new_data.get('sparks'))
        row = 1
        has_sparks = False
        for category, data in diff_results.items():
            if not data['existing'] and not data['new']: continue
            has_sparks = True
            cat_label = QLabel(f"<b>{category.replace('_', ' ').title()}:</b>")
            existing_label, new_label = QLabel(", ".join(data['existing'])), QLabel(", ".join(data['new']))
            existing_label.setWordWrap(True); new_label.setWordWrap(True)
            cb_existing = QCheckBox()
            cb_new = QCheckBox()
            cb_existing.setChecked(True)
            button_group = QButtonGroup(self)
            button_group.addButton(cb_existing)
            button_group.addButton(cb_new)
            button_group.setExclusive(True)
            self.spark_choice_widgets[category] = cb_existing
            existing_widget = QWidget()
            existing_layout = QHBoxLayout(existing_widget)
            existing_layout.addWidget(cb_existing)
            existing_layout.addWidget(existing_label, 1)
            new_widget = QWidget()
            new_layout = QHBoxLayout(new_widget)
            new_layout.addWidget(cb_new)
            new_layout.addWidget(new_label, 1)
            self.sparks_layout.addWidget(cat_label, row, 0)
            self.sparks_layout.addWidget(existing_widget, row, 1)
            self.sparks_layout.addWidget(new_widget, row, 2)
            row += 1
        
        if not has_sparks:
            self.sparks_layout.addWidget(QLabel("No sparks found for this entry."), 1, 0, 1, 3)

    def save_resolution(self):
        if not (0 <= self.current_conflict_index < len(self.conflicts)): return

        conflict = self.conflicts[self.current_conflict_index]
        resolved_entry, existing_data, new_data = conflict['new'].copy(), conflict['existing'], conflict['new']
        
        resolved_sparks = []
        existing_sparks_list = json.loads(existing_data.get('sparks', '[]') or '[]')
        new_sparks_list = json.loads(new_data.get('sparks', '[]') or '[]')

        # The key of spark_choice_widgets is now "parent", "grandparent_1", etc.
        for spark_type, checkbox in self.spark_choice_widgets.items():
            source_list = existing_sparks_list if checkbox.isChecked() else new_sparks_list
            for spark in source_list:
                if spark.get('type') == spark_type:
                    resolved_sparks.append(spark)

        resolved_entry['sparks'] = json.dumps(resolved_sparks)

        numeric_cols = ['entry_id', 'score', 'speed', 'stamina', 'power', 'guts', 'wit']
        for col in numeric_cols:
            if col in resolved_entry:
                try:
                    resolved_entry[col] = int(resolved_entry[col])
                except (ValueError, TypeError):
                    resolved_entry[col] = 0

        all_runners_file = os.path.join(BASE_DIR, 'data', 'all_runners.csv')
        df = pd.read_csv(all_runners_file, dtype={'entry_hash': str})
        row_index = df.index[df['entry_hash'] == conflict['hash']].tolist()
        if row_index:
            idx = row_index[0]
            for col, value in resolved_entry.items():
                if col in df.columns: df.loc[idx, col] = value
            df.to_csv(all_runners_file, index=False)

        self.conflicts.pop(self.current_conflict_index)
        with open(self.conflicts_file, 'w') as f: json.dump(self.conflicts, f, indent=4)

        if not self.conflicts:
            self.info_label.setText("All conflicts resolved."); self.accept()
        else:
            self.display_conflict(self.current_conflict_index % len(self.conflicts))

if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setFont(QFont("Calibri", 12))
    app.setStyleSheet(QSS)
    dialog = ConflictResolutionDialog()
    if dialog.conflicts:
        dialog.exec_()
    sys.exit(0)
