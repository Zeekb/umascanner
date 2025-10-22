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

def get_grade_for_stat(value):
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

def get_aptitude_grade_color(grade):
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
