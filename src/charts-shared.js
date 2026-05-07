// Shared theme helpers — imported by charts-main, charts-analysis, charts-episode

export function isDarkMode() {
    return document.documentElement.dataset.theme === 'dark';
}

export function getChartColors() {
    const dark = isDarkMode();
    return {
        gridLine:        dark ? '#2a2b3e' : '#f0f0f0',
        yLabel:          dark ? '#52536e' : '#ccc',
        boundaryLine:    dark ? '#32334e' : '#ddd',
        dateLabel:       dark ? '#52536e' : '#bbb',
        weekdayLabel:    dark ? '#3e3f58' : '#ccc',
        todayLabel:      dark ? '#e2e4f0' : '#2c3e50',
        dotCenter:       dark ? '#1a1b2e' : 'white',
        barNormal:       dark ? '#3a3d6e' : '#c5cff7',
        barLabelNormal:  dark ? '#9a9bb8' : '#999',
        monthYear:       dark ? '#52536e' : '#aaa',
    };
}
