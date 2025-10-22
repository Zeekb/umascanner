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
