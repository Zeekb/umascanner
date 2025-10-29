import sys
import pandas as pd
import json
import os
from data_updater import format_json_with_custom_layout
from PyQt5.QtWidgets import (
    QApplication, QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QGroupBox, 
    QGridLayout, QSizePolicy, QButtonGroup, QWidget, QScrollArea, QRadioButton
)
from PyQt5.QtGui import QFont
from PyQt5.QtCore import Qt

# --- Path Configuration (Executable Aware) ---

# 1. Get path for EXTERNAL data (conflicts.json, all_runners.json)
if len(sys.argv) > 1:
    # External data path is passed as a command-line argument from main.py
    EXTERNAL_DATA_DIR = sys.argv[1]
else:
    # Fallback for testing / running directly as a script
    EXTERNAL_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')

# 2. Get path for BUNDLED data (skills.json, runner_skills.json)
if getattr(sys, 'frozen', False):
    # We are running as a bundled executable (launched by main.exe)
    BUNDLED_ROOT = sys._MEIPASS
    BUNDLED_GAME_DATA_DIR = os.path.join(BUNDLED_ROOT, "data", "game_data")
else:
    # We are running as a script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    BUNDLED_GAME_DATA_DIR = os.path.join(script_dir, '..', 'data', 'game_data')

# 3. Define final file paths
CONFLICTS_FILE = os.path.join(EXTERNAL_DATA_DIR, 'conflicts.json')
ALL_RUNNERS_FILE = os.path.join(EXTERNAL_DATA_DIR, 'all_runners.json')
SKILLS_FILE = os.path.join(BUNDLED_GAME_DATA_DIR, 'skills.json')
RUNNER_SKILLS_FILE = os.path.join(BUNDLED_GAME_DATA_DIR, 'runner_skills.json')

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
        self.setGeometry(100, 100, 1600, 900)
        
        self.conflicts = []
        self.current_conflict_index = 0
        self.choice_widgets = {}
        self.load_conflicts()
        
        self.init_ui()
        if self.conflicts:
            self.display_conflict(0)
        else:
            self.main_layout.addWidget(QLabel("No conflicts found."))
            self.save_button.setEnabled(False)

    def load_conflicts(self):
        self.conflicts_file = CONFLICTS_FILE
        if os.path.exists(self.conflicts_file):
            with open(self.conflicts_file, 'r', encoding='utf-8') as f:
                self.conflicts = json.load(f)

    def init_ui(self):
        # --- Main Dialog Layout (this holds everything) ---
        dialog_layout = QVBoxLayout(self)

        # --- Scroll Area Setup ---
        self.scroll_area = QScrollArea(self)
        self.scroll_area.setWidgetResizable(True)
        
        scroll_content_widget = QWidget()
        self.main_layout = QVBoxLayout(scroll_content_widget) # This layout is for scrollable content
        self.scroll_area.setWidget(scroll_content_widget)
        
        # Add the scroll area to the main dialog layout
        dialog_layout.addWidget(self.scroll_area)
        # --- END Scroll Area Setup ---

        self.info_label = QLabel()
        self.main_layout.addWidget(self.info_label)

        key_group = QGroupBox("Sparks Legend")
        key_layout = QHBoxLayout(key_group)
        key_layout.addWidget(QLabel('<font color="black">Black: Unchanged</font>'))
        key_layout.addWidget(QLabel('<font color="green">Green: New Spark</font>'))
        key_layout.addWidget(QLabel('<font color="red">Red: Spark Not Present in New</font>'))
        key_layout.addWidget(QLabel('<font color="blue">Blue: Count/Value Changed</font>'))
        key_layout.addStretch()
        self.main_layout.addWidget(key_group)

        # Main container for basic, non-stat, non-apt fields
        self.fields_group = QGroupBox("Conflicting Fields")
        self.fields_layout = QGridLayout(self.fields_group)
        self.main_layout.addWidget(self.fields_group)
        
        # Dedicated group for stats
        self.stats_group = QGroupBox("Conflicting Stats")
        self.stats_layout = QHBoxLayout(self.stats_group)
        self.main_layout.addWidget(self.stats_group)

        # Dedicated group for aptitudes
        self.apts_group = QGroupBox("Conflicting Aptitudes")
        self.apts_layout = QGridLayout(self.apts_group)
        self.main_layout.addWidget(self.apts_group)
        
        # Dedicated group for skills
        self.skills_group = QGroupBox("Conflicting Skills")
        self.skills_layout = QVBoxLayout(self.skills_group)
        self.main_layout.addWidget(self.skills_group)
        
        # Dedicated group for sparks
        self.sparks_group = QGroupBox("Conflicting Sparks")
        self.sparks_layout = QGridLayout(self.sparks_group)
        self.main_layout.addWidget(self.sparks_group)

        # Buttons are added to the main dialog_layout, NOT the scrollable main_layout.
        button_layout = QHBoxLayout()
        button_layout.addStretch()
        self.save_button = QPushButton("Save and Resolve Next")
        self.save_button.clicked.connect(self.save_resolution)
        button_layout.addWidget(self.save_button)
        dialog_layout.addLayout(button_layout) # This is the crucial fix

    def diff_sparks(self, existing_sparks, new_sparks):
        # ... (This helper function remains the same)
        diffs = {}
        for spark_type in ["parent", "gp1", "gp2"]:
            e_map = {(s['color'], s['spark_name']): s['count'] for s in existing_sparks.get(spark_type, [])}
            n_map = {(s['color'], s['spark_name']): s['count'] for s in new_sparks.get(spark_type, [])}
            all_keys = sorted(list(set(e_map.keys()) | set(n_map.keys())))
            e_display, n_display = [], []
            for color, name in all_keys:
                e_count, n_count = e_map.get((color, name)), n_map.get((color, name))
                if e_count and n_count:
                    tag = "black" if e_count == n_count else "blue"
                    e_display.append(f'<font color="{tag}">{name}({e_count})</font>')
                    n_display.append(f'<font color="{tag}">{name}({n_count})</font>')
                elif e_count:
                    e_display.append(f'<font color="red">{name}({e_count})</font>')
                elif n_count:
                    n_display.append(f'<font color="green">{name}({n_count})</font>')
            diffs[spark_type] = (", ".join(e_display), ", ".join(n_display))
        return diffs

    def display_conflict(self, index):
        # Clear all layouts before populating
        for layout in [self.fields_layout, self.stats_layout, self.apts_layout, self.skills_layout, self.sparks_layout]:
            clear_layout(layout)
        self.choice_widgets = {}

        self.current_conflict_index = index
        conflict = self.conflicts[index]
        existing, new = conflict['existing'], conflict['new']
        self.info_label.setText(f"<h2>Conflict {index + 1} of {len(self.conflicts)} for: {new.get('name', 'N/A')}</h2> (Hash: {conflict['hash']})")

        # Define key categories
        stat_keys = ['speed', 'stamina', 'power', 'guts', 'wit']
        apt_keys = ["turf", "dirt", "sprint", "mile", "medium", "long", "front", "pace", "late", "end"]
        basic_keys = ['name', 'score', 'gp1', 'gp2']
        complex_keys = ['skills', 'sparks']

        # --- Populate Basic Info ---
        self.fields_group.setVisible(False)
        field_row = 0
        for key in basic_keys:
            if existing.get(key) != new.get(key):
                self.fields_group.setVisible(True)
                self.fields_layout.addWidget(QLabel(f"<b>{key.replace('_', ' ').title()}:</b>"), field_row, 0)
                self.fields_layout.addLayout(self.create_choice_row(key, str(existing.get(key)), str(new.get(key))), field_row, 1)
                field_row += 1

        # --- Populate Stats Horizontally ---
        self.stats_group.setVisible(False)
        stats_have_conflict = any(existing.get(k) != new.get(k) for k in stat_keys)
        if stats_have_conflict:
            self.stats_group.setVisible(True)
            for key in stat_keys:
                self.stats_layout.addLayout(self.create_vertical_choice_column(key, str(existing.get(key)), str(new.get(key))))
        
        # --- Populate Aptitudes ---
        self.apts_group.setVisible(False)
        apt_row = 0
        for key in apt_keys:
            if existing.get(key) != new.get(key):
                self.apts_group.setVisible(True)
                self.apts_layout.addWidget(QLabel(f"<b>{key.replace('apt_', '').title()}:</b>"), apt_row, 0)
                self.apts_layout.addLayout(self.create_choice_row(key, str(existing.get(key)), str(new.get(key))), apt_row, 1)
                apt_row += 1

        # --- Populate Skills ---
        self.skills_group.setVisible(False)
        if existing.get('skills') != new.get('skills'):
            self.skills_group.setVisible(True)
            e_skills, n_skills = set(existing.get('skills', [])), set(new.get('skills', []))
            e_display = sorted([f'<font color="red">{s}</font>' for s in e_skills - n_skills] + [s for s in e_skills & n_skills])
            n_display = sorted([f'<font color="green">{s}</font>' for s in n_skills - e_skills] + [s for s in n_skills & e_skills])
            self.skills_layout.addLayout(self.create_choice_row('skills', "<br>".join(e_display), "<br>".join(n_display)))

        # --- Populate Sparks ---
        self.sparks_group.setVisible(False)
        if existing.get('sparks') != new.get('sparks'):
            self.sparks_group.setVisible(True)
            spark_diffs = self.diff_sparks(existing.get('sparks',{}), new.get('sparks',{}))
            spark_row = 0
            for spark_type in ["parent", "gp1", "gp2"]:
                e_text, n_text = spark_diffs[spark_type]
                if e_text != n_text:
                    self.sparks_layout.addWidget(QLabel(f"<b>{spark_type.title()}:</b>"), spark_row, 0)
                    self.sparks_layout.addLayout(self.create_choice_row(spark_type, e_text, n_text), spark_row, 1)
                    spark_row += 1

    def create_choice_row(self, key, existing_text, new_text):
        # ... (This helper function remains the same)
        layout = QHBoxLayout()
        group = QButtonGroup(self)
        rb_existing = QRadioButton("Use Existing")
        rb_existing.setChecked(True)
        lbl_existing = QLabel(f'<font color="blue">{existing_text}</font>')
        lbl_existing.setWordWrap(True)
        vbox_existing = QVBoxLayout()
        vbox_existing.addWidget(rb_existing); vbox_existing.addWidget(lbl_existing)
        rb_new = QRadioButton("Use New")
        lbl_new = QLabel(f'<font color="blue">{new_text}</font>')
        lbl_new.setWordWrap(True)
        vbox_new = QVBoxLayout()
        vbox_new.addWidget(rb_new); vbox_new.addWidget(lbl_new)
        group.addButton(rb_existing); group.addButton(rb_new)
        layout.addLayout(vbox_existing, 1); layout.addLayout(vbox_new, 1)
        self.choice_widgets[key] = rb_existing
        return layout

    def create_vertical_choice_column(self, key, existing_text, new_text):
        layout = QVBoxLayout()
        group = QButtonGroup(self)
        
        lbl_key = QLabel(f"<b>{key.title()}</b>")
        lbl_key.setAlignment(Qt.AlignCenter)
        layout.addWidget(lbl_key)

        rb_existing = QRadioButton(f"Existing: {existing_text}")
        rb_existing.setChecked(True)
        
        rb_new = QRadioButton(f"New: {new_text}")
        
        # Color the text if they are different
        if existing_text != new_text:
            rb_existing.setText(f'Existing: <font color="blue">{existing_text}</font>')
            rb_new.setText(f'New: <font color="blue">{new_text}</font>')

        group.addButton(rb_existing); group.addButton(rb_new)
        layout.addWidget(rb_existing); layout.addWidget(rb_new)
        layout.addStretch()

        self.choice_widgets[key] = rb_existing
        return layout

    def save_resolution(self):
        conflict = self.conflicts[self.current_conflict_index]
        resolved_entry = conflict['new'].copy() # Start with the new entry

        # Overwrite with "existing" choices where selected
        for key, rb_existing in self.choice_widgets.items():
            if rb_existing.isChecked():
                if key in ["parent", "gp1", "gp2"]: # Handle granular sparks
                    if 'sparks' not in resolved_entry: resolved_entry['sparks'] = {}
                    resolved_entry['sparks'][key] = conflict['existing']['sparks'].get(key)
                else: # Handle all other fields
                    resolved_entry[key] = conflict['existing'].get(key)
        
        # For sparks, ensure non-conflicting types are carried over from the 'new' entry
        if 'sparks' in resolved_entry and 'sparks' in conflict['new']:
            for spark_type in ["parent", "gp1", "gp2"]:
                if spark_type not in self.choice_widgets: # This type had no conflict
                    resolved_entry['sparks'][spark_type] = conflict['new']['sparks'].get(spark_type)

        # --- SAVE TO JSON ---
        all_runners_file = ALL_RUNNERS_FILE
        with open(all_runners_file, 'r', encoding='utf-8') as f:
            all_data = json.load(f)
        
        for i, entry in enumerate(all_data):
            if entry.get('entry_hash') == conflict['hash']:
                all_data[i] = resolved_entry
                break
        
        with open(all_runners_file, 'w', encoding='utf-8') as f:
            f.write(format_json_with_custom_layout(all_data))

        # --- Update conflicts file ---
        self.conflicts.pop(self.current_conflict_index)
        with open(self.conflicts_file, 'w', encoding='utf-8') as f:
            json.dump(self.conflicts, f, indent=2)

        if not self.conflicts:
            self.info_label.setText("<h2>All conflicts resolved!</h2>"); self.accept()
        else:
            self.display_conflict(self.current_conflict_index % len(self.conflicts))

if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setFont(QFont("Calibri", 12))
    # app.setStyleSheet(QSS)
    dialog = ConflictResolutionDialog()
    if dialog.conflicts:
        dialog.exec_()
    sys.exit(0)