var userSettings = new UserSettings();
var currentWorkout = new Workout();
var rawPowerData = [];
var rawDurations = [];
let chartInstance;



// Define power zones as a function of FTP
function calculatePowerZones(ftp) {
    return [
        { name: ['Z1', 'Active Recovery', `0 - ${Math.round(0.55 * ftp)}`], min: 0, max: 0.55 * ftp },
        { name: ['Z2', "Endurance", `${Math.round(0.55 * ftp)} - ${Math.round(0.75 * ftp)}`], min: 0.56 * ftp, max: 0.75 * ftp },
        { name: ['Z3', "Tempo", `${Math.round(0.75 * ftp)} - ${Math.round(0.90 * ftp)}`], min: 0.76 * ftp, max: 0.90 * ftp },
        { name: ['Z4', "Threshold", `${Math.round(0.90 * ftp)} - ${Math.round(1.05 * ftp)}`], min: 0.91 * ftp, max: 1.05 * ftp },
        { name: ['Z5', "VO2 Max", `${Math.round(1.05 * ftp)} - ${Math.round(1.20 * ftp)}`], min: 1.06 * ftp, max: 1.20 * ftp },
        { name: ['Z6', "Anaerobic", `${Math.round(1.20 * ftp)} - ${Math.round(1.50 * ftp)}`], min: 1.21 * ftp, max: 1.50 * ftp },
        { name: ['Z7', "Neuromuscular", `${Math.round(1.50 * ftp)} - Destruction`], min: 1.51 * ftp, max: 10.0 * ftp }
    ];
}

function processPowerData(ftp) {
    const zones = calculatePowerZones(ftp);
    let zoneTimes = new Array(zones.length).fill(0);

    // Assign time spent in each zone
    rawPowerData.forEach((power, index) => {
        const absolutePower = power * ftp;
        for (let i = 0; i < zones.length; i++) {
            if (absolutePower >= zones[i].min && absolutePower <= zones[i].max) {
                zoneTimes[i] += rawDurations[index];
                break;
            }
        }
    });

    // Convert seconds to minutes
    return zoneTimes.map(time => (time / 60).toFixed(2));
}

function updateChart(ftp) {
    const zoneTimes = processPowerData(ftp);
    const labels = calculatePowerZones(ftp).map(zone => zone.name);

    if (chartInstance) {
        chartInstance.destroy();
    }

    const ctx = document.getElementById("powerChart").getContext("2d");
    chartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            seconds: rawDurations.reduce((total, current) => total + current, 0),
            datasets: [{
                label: "Programmed Time in Zone (minutes)",
                data: zoneTimes,
                backgroundColor: "rgba(75, 192, 192, 0.6)"
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true, ticks: {
                        callback: function (value) {
                            console.log(rawDurations.reduce((total, current) => total + current, 0));
                            return Math.round((value * 60 / rawDurations.reduce((total, current) => total + current, 0)) * 100) + '%';
                        }
                    }
                }
            }
        }
    });
}

/**
 * Formats a duration (in seconds) into a human-readable string.
 * Examples:
 *   1      => "1 s"
 *   15     => "15 s"
 *   60     => "1 min"
 *   300    => "5 min"
 *   3600   => "1 hr"
 *   5400   => "1.5 hr"
 *
 * @param {number} seconds - Duration in seconds.
 * @returns {string} The formatted duration string.
 */
function formatDuration(seconds) {
    if (seconds < 60) {
        return seconds + " s";
    } else if (seconds < 3600) {
        const minutes = seconds / 60;
        return (minutes % 1 === 0) ? minutes + " min" : minutes.toFixed(1) + " min";
    } else {
        const hours = seconds / 3600;
        return (hours % 1 === 0) ? hours + " hr" : hours.toFixed(1) + " hr";
    }
}

/**
 * Renders a power curve chart in the <canvas id="lineChart"> element.
 *
 * @param {Array} powerCurveData - Array of objects: { duration: number, power: number }
 */
function updatePowerCurveChart(powerCurveData) {
    // Extract durations (in seconds) and power values from powerCurveData.
    const durations = powerCurveData.map(point => point.duration);
    const powers = powerCurveData.map(point => point.power);
    const ctx = document.getElementById("curveChart").getContext("2d");
    // If a previous chart exists, destroy it.
    if (window.powerCurveChart) {
        window.powerCurveChart.destroy();
    }

    window.powerCurveChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: durations, // These are the durations in seconds.
            datasets: [{
                label: 'Programmed Power Curve (W)',
                data: powerCurveData.map(pt => ({ x: pt.duration, y: pt.power })),
                fill: false,
                borderColor: 'rgba(75, 192, 192, 1)',
                tension: 0.1,
                pointRadius: 0 // For a cleaner line, you can hide the points.
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    type: 'logarithmic',
                    position: 'bottom',
                    // Override the default tick generation with our custom ticks.
                    afterBuildTicks: axis => axis.ticks = durations.map(v => ({ value: v })),
                    title: {
                        display: true,
                        text: 'Duration'
                    },
                    ticks: {
                        autoSkip: false, // prevent Chart.js from auto-skipping ticks
                        // Format tick labels using the helper function.
                        callback: function (value) {
                            return formatDuration(value);
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 1000,
                    title: {
                        display: true,
                        text: 'Max Avg Power (W)'
                    }
                }
            }
        }
    });
}


document.addEventListener('DOMContentLoaded', function () {
    if (userSettings.enableWorkoutInsertion) setupWorkoutInsertion(true);
    if (userSettings.enableUrlCreation) setupCreateWorkoutUrlButton(true);
    populateUserSettings();

    var savedWorkout = null;
    var qs = new URLSearchParams(window.location.search);
    if (qs.has('n') && qs.has('w')) {
        savedWorkout = new Workout();
        savedWorkout.loadFromUrl(window.location.search);
    } else {
        savedWorkout = userSettings.getAndUnsetWorkoutForEditing();
    }
    if (!savedWorkout) return;
    var workoutToBeEdited = new Workout();
    workoutToBeEdited.reconstituteFromDeserialized(savedWorkout);
    loadWorkout(workoutToBeEdited);
});


document.getElementById("chart").addEventListener("click", function (event) {
    event.preventDefault();

    data = returnInfo(currentWorkout.toZwoXml());
    console.log(data);
    rawPowerData = data.powers;
    rawDurations = data.durations;

    let ftp = userSettings.userFtp;
    document.getElementById('Cal').textContent = data.totalCalories;
    document.getElementById('kJoules').textContent = data.totalKj;
    document.getElementById('FTP').textContent = userSettings.userFtp;
    document.getElementById('Carbs').textContent = data.carbs;
    document.getElementById('Water').textContent = data.water;
    document.getElementById('workout_info').classList.remove('hidden');
    updateChart(ftp);
    updatePowerCurveChart(data.powerCurve);
});


document.getElementById('divWorkoutInfo').addEventListener('input', function (e) {
    if (e.target.id == 'txtName') currentWorkout.name = e.target.value;
    if (e.target.id == 'txtDescription') currentWorkout.description = e.target.value;
    if (e.target.id == 'txtAuthor') currentWorkout.author = e.target.value;
    if (e.target.id == 'txtTags') currentWorkout.setTags(e.target.value);
});


document.getElementById('divSegmentButtons').addEventListener('click', function (e) {
    var svg;
    if (e.target.tagName.toLowerCase() == 'svg')
        svg = e.target;
    else if (e.target.tagName.toLowerCase() == 'path')
        svg = e.target.parentNode;
    else
        return;

    var t = svg.getAttribute('data-t');
    if (!t) return;
    var p1 = svg.getAttribute('data-p-1');
    var d1 = svg.getAttribute('data-d-1');
    var p2 = svg.getAttribute('data-p-2');
    var d2 = svg.getAttribute('data-d-2');
    var r = svg.getAttribute('data-r');
    var segment = new Segment(t, p1, d1, p2, d2, r);
    currentWorkout.addSegment(segment);
    addSegmentToChart(segment, true);
}, false);


document.getElementById('btnInsertWorkout').addEventListener('click', function (e) {
    var selectedWorkoutName = document.getElementById('selWorkout').value;
    var workout = new Workout();
    workout.reconstituteFromDeserialized(userSettings.getMyWorkout(selectedWorkoutName));
    for (var i = 0; i < workout.segments.length; i++) {
        currentWorkout.addSegment(workout.segments[i]);
        addSegmentToChart(workout.segments[i], i == (workout.segments.length - 1));
    }
});


document.getElementById('btnDuplicate').addEventListener('click', function () {
    var selected = getSelectedSegment();
    if (!selected) return;

    var segmentToDuplicate = currentWorkout.segments.find(s => s.id == selected.getAttribute('data-id'));
    var duplicatedSegment = new Segment();
    duplicatedSegment.duplicateFrom(segmentToDuplicate);
    currentWorkout.addSegment(duplicatedSegment);
    addSegmentToChart(duplicatedSegment, true);
});


document.getElementById('btnSelectPrevious').addEventListener('click', function () {
    var selected = getSelectedSegment();
    if (!selected) return;
    if (!selected.previousSibling) return;
    selected.previousSibling.querySelector('input').click();
});


document.getElementById('btnSelectNext').addEventListener('click', function () {
    var selected = getSelectedSegment();
    if (!selected) return;
    if (!selected.nextSibling) return;
    selected.nextSibling.querySelector('input').click();
});


document.getElementById('btnMoveLeft').addEventListener('click', function (e) {
    var selectedSegment = getSelectedSegment();
    if (!selectedSegment) return;
    var previousBlock = selectedSegment.previousElementSibling;
    if (!previousBlock) return;

    var index = currentWorkout.segments.findIndex(s => s.id == selectedSegment.getAttribute('data-id'));
    var temp = currentWorkout.segments[index];
    currentWorkout.segments[index] = currentWorkout.segments[index - 1];
    currentWorkout.segments[index - 1] = temp;
    selectedSegment.parentNode.insertBefore(selectedSegment, previousBlock);
});


document.getElementById('btnMoveRight').addEventListener('click', function (e) {
    var selectedSegment = getSelectedSegment();
    if (!selectedSegment) return;
    var nextBlock = selectedSegment.nextElementSibling;
    if (!nextBlock) return;

    var index = currentWorkout.segments.findIndex(s => s.id == selectedSegment.getAttribute('data-id'));
    var temp = currentWorkout.segments[index];
    currentWorkout.segments[index] = currentWorkout.segments[index + 1];
    currentWorkout.segments[index + 1] = temp;
    selectedSegment.parentNode.insertBefore(nextBlock, selectedSegment);
});


document.getElementById('btnDelete').addEventListener('click', function (e) {
    var selectedSegment = getSelectedSegment();
    if (!selectedSegment) return;
    var index = currentWorkout.segments.findIndex(s => s.id == selectedSegment.getAttribute('data-id'));
    currentWorkout.segments.splice(index, 1);
    var previousBlock = selectedSegment.previousElementSibling;
    var nextBlock = selectedSegment.nextElementSibling;
    selectedSegment.parentNode.removeChild(selectedSegment);
    if (nextBlock) {
        nextBlock.querySelector('input[type=radio]').checked = true;
        loadSegmentInfo(nextBlock.getAttribute('data-id'));
    }
    else if (previousBlock) {
        previousBlock.querySelector('input[type=radio]').checked = true;
        loadSegmentInfo(previousBlock.getAttribute('data-id'));
    } else {
        loadNoSegment();
    }
    updateWorkoutDuration();
});


document.getElementById('divSegmentChart').addEventListener('change', function (e) {
    loadSegmentInfo(e.target.id);
});


document.getElementById('btnShowCadence').addEventListener('click', function () {
    var selectedSegment = getSelectedSegment();
    if (!selectedSegment) return;

    showModal('divModalCadence');
});


document.getElementById('btnShowTextEvents').addEventListener('click', function () {
    var selectedSegment = getSelectedSegment();
    if (!selectedSegment) return;

    showModal('divModalTextEvents');
});


document.getElementById('btnShowOptions').addEventListener('click', function () {
    var selectedSegment = getSelectedSegment();
    if (!selectedSegment) return;

    var chkDisableFlatRoad = document.getElementById('chkDisableFlatRoad');
    var segment = currentWorkout.segments.find(s => s.id == selectedSegment.getAttribute('data-id'));
    if (segment.t == 'f')
        chkDisableFlatRoad.removeAttribute('disabled');
    else
        chkDisableFlatRoad.setAttribute('disabled', 'disabled');

    showModal('divModalOptions');
});


document.getElementById('btnDismissCadence').addEventListener('click', dismissModal);
document.getElementById('btnDismissTextEvents').addEventListener('click', dismissModal);
document.getElementById('btnDismissOptions').addEventListener('click', dismissModal);
document.getElementById('btnDismissUrl').addEventListener('click', dismissModal);
document.getElementById('btnDismissSettings').addEventListener('click', dismissModal);

document.getElementById('chkCadence').addEventListener('click', function () {
    var selectedSegment = getSelectedSegment();
    if (!selectedSegment) return;

    var txtC1 = document.getElementById('txtC1');
    var txtC2 = document.getElementById('txtC2');
    var segmentObj = currentWorkout.segments.find(s => s.id == selectedSegment.getAttribute('data-id'));

    if (this.checked) {
        segmentObj.c1 = 90;
        txtC1.value = 90;
        txtC1.removeAttribute('disabled');

        if (segmentObj.t == 'i') {
            segmentObj.c2 = 90;
            txtC2.value = 90;
            txtC2.removeAttribute('disabled');
        } else {
            txtC2.value = null;
            txtC2.setAttribute('disabled', true);
        }
    } else {
        if (segmentObj.hasOwnProperty('c1')) segmentObj.c1 = null;
        if (segmentObj.hasOwnProperty('c2')) segmentObj.c2 = null;
        txtC1.value = null;
        txtC2.value = null;
        txtC1.setAttribute('disabled', true);
        txtC2.setAttribute('disabled', true);
    }

    txtC1.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
});


document.getElementById('chkShowAvg').addEventListener('click', function () {
    var selectedSegment = getSelectedSegment();
    if (!selectedSegment) return;
    var segmentObj = currentWorkout.segments.find(s => s.id == selectedSegment.getAttribute('data-id'));
    segmentObj.avg = this.checked;
});


document.getElementById('chkDisableFlatRoad').addEventListener('click', function () {
    var selectedSegment = getSelectedSegment();
    if (!selectedSegment) return;
    var segmentObj = currentWorkout.segments.find(s => s.id == selectedSegment.getAttribute('data-id'));
    segmentObj.dfr = this.checked;
});


document.getElementById('divSegmentInputs').addEventListener('input', function (e) {
    if (e.target.tagName != 'INPUT' && e.target.tagName != 'BUTTON') return;

    var selectedSegment = getSelectedSegment();
    if (!selectedSegment) return;

    var segment = currentWorkout.segments.find(s => s.id == selectedSegment.getAttribute('data-id'));
    var targetProperty = e.target.getAttribute('data-target');
    var label = selectedSegment.querySelector('label');

    if (e.target.type == 'text') {
        var te = segment.textEvents.find(t => t.id == e.target.parentNode.parentNode.id);
        te.text = e.target.value;
        return; // no redraw if just changing textevent message
    }

    if (e.target.name == 'offset') {
        var te = segment.textEvents.find(t => t.id == e.target.parentNode.parentNode.id);
        te.offset = e.target.value;
    } else if (e.target.type == 'number') {
        segment[targetProperty] = e.target.value;
    }

    label.innerHTML = '';
    var svgs = segment.toSvgs(userSettings);
    for (var i = 0; i < svgs.length; i++) {
        label.appendChild(svgs[i]);
    }
    updateWorkoutDuration();
    updateTimeInMinutes();
    updateAbsolutePower();
});


document.getElementById('btnAddTextEvent').addEventListener('click', function () {
    var selectedSegment = getSelectedSegment();
    if (!selectedSegment) return;
    var text = document.querySelector('#divTextEventToClone input').value;
    var offset = document.querySelector('#divTextEventToClone input[type=number]').value;
    var id = currentWorkout.segments.find(s => s.id == selectedSegment.getAttribute('data-id')).addTextEvent(text, offset);
    addTextEventControls({ id: id, text: text, offset: offset });
    var segment = currentWorkout.segments.find(s => s.id == selectedSegment.getAttribute('data-id'));
    var label = selectedSegment.querySelector('label');
    label.innerHTML = '';
    var svgs = segment.toSvgs(userSettings);
    for (var i = 0; i < svgs.length; i++) {
        label.appendChild(svgs[i]);
    }
});


document.getElementById('divTextEvents').addEventListener('click', function (e) {
    if (e.target.tagName != 'BUTTON') return;
    var divToDelete = e.target.parentNode.parentNode;
    var selectedSegment = getSelectedSegment();
    var segment = currentWorkout.segments.find(s => s.id == selectedSegment.getAttribute('data-id'));
    var textEventIndexToDelete = segment.textEvents.findIndex(t => t.id == divToDelete.id);
    segment.textEvents.splice(textEventIndexToDelete, 1);
    divToDelete.parentNode.removeChild(divToDelete);
    var label = selectedSegment.querySelector('label');
    label.innerHTML = '';
    var svgs = segment.toSvgs(userSettings);
    for (var i = 0; i < svgs.length; i++) {
        label.appendChild(svgs[i]);
    }
});


document.getElementById('btnSaveToMyWorkouts').addEventListener('click', function () {
    if (!currentWorkout.name) {
        var name = getName();
        currentWorkout.name = name;
        document.getElementById('txtName').value = name;
    }

    var existingWorkout = userSettings.getMyWorkout(currentWorkout.name);

    if (existingWorkout) {
        var response = confirm('You already have a workout named ' + currentWorkout.name + '. Do you want to overwrite it?');
        if (!response) return;
    }

    userSettings.saveMyWorkout(currentWorkout);
    var savedDiv = this.parentNode.querySelector('.saved');
    savedDiv.classList.remove('saved');
    setTimeout(function () { savedDiv.classList.add('saved'); }, 2200);

    if (userSettings.enableWorkoutInsertion) setupWorkoutInsertion(true);
});


document.getElementById('btnDownloadZwoFile').addEventListener('click', function () {
    if (!currentWorkout.name) {
        var name = getName();
        currentWorkout.name = name;
        document.getElementById('txtName').value = name;
    }

    var xml = currentWorkout.toZwoXml();
    var blob = new Blob([xml], { type: "application/octet-stream" });
    var fileName = currentWorkout.name.replace(/[^A-Z0-9]/ig, '_') + '.zwo';;
    saveAs(blob, fileName);
});


document.getElementById('btnCreateUrl').addEventListener('click', function () {
    if (!currentWorkout.name) {
        var name = getName();
        currentWorkout.name = name;
        document.getElementById('txtName').value = name;
    }

    var url = currentWorkout.toUrl();
    var link = document.getElementById('aUrl');
    link.setAttribute('href', url);
    link.innerText = url;
    showModal('divModalCreateUrl');
});


document.getElementById('aSettings').addEventListener('click', function () {
    showModal('divModalSettings');
});


document.getElementById('btnDismissSettings').addEventListener('click', function (e) {
    var checkboxes = document.querySelectorAll('#divModalSettings input[type=checkbox]');
    for (var i = 0; i < checkboxes.length; i++) {
        userSettings[checkboxes[i].getAttribute('data-key')] = checkboxes[i].checked;
    }

    var numInputs = document.querySelectorAll('#divModalSettings input[type=number]');
    for (var i = 0; i < numInputs.length; i++) {
        userSettings[numInputs[i].getAttribute('data-key')] = numInputs[i].value;
    }

    userSettings.saveSettings();

    setupWorkoutInsertion(userSettings.enableWorkoutInsertion);
    setupCreateWorkoutUrlButton(userSettings.enableUrlCreation);
    updateTimeInMinutes();
    updateAbsolutePower();
    if (userSettings.displayTss)
        document.getElementById('spanTss').innerHTML = currentWorkout.calculateScore();
    else
        document.getElementById('spanTss').innerHTML = '';
    if (userSettings.displayXp)
        document.getElementById('spanXp').innerHTML = currentWorkout.calculateXp() + " XP";
    else
        document.getElementById('spanXp').innerHTML = '';
});


document.getElementById('divSegmentChart').addEventListener('dragenter', function (e) {
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    this.classList.add('dragover');
}, false);


document.getElementById('divSegmentChart').addEventListener('dragleave', function (e) {
    e.stopPropagation();
    e.preventDefault();
    this.classList.remove('dragover');
}, false);


document.getElementById('divSegmentChart').addEventListener('dragover', function (e) {
    e.stopPropagation();
    e.preventDefault();
}, false);


document.getElementById('divSegmentChart').addEventListener('drop', function (e) {
    e.stopPropagation();
    e.preventDefault();
    this.classList.remove('dragover');
    var files = e.dataTransfer.files;
    if (files.length != 1) return;
    var ext = files[0].name.toLowerCase().substr(-4);
    var acceptableExts = ['.zwo', '.erg', '.mrc'];
    if (acceptableExts.indexOf(ext) < 0) return;

    var reader = new FileReader();
    reader.onload = function (event) {
        var text = event.target.result;
        var workout = new Workout();
        if (ext == '.zwo')
            workout.loadFromXml(text);
        else
            workout.loadFromErgOrMrc(text);
        loadWorkout(workout);
    };
    reader.readAsText(files[0]);
}, false);


function setupWorkoutInsertion(enable) {

    var sel = document.getElementById('selWorkout');
    var btn = document.getElementById('btnInsertWorkout');

    if (enable) {
        sel.removeAttribute('hidden');
        btn.removeAttribute('hidden');
    } else {
        sel.setAttribute('hidden', '');
        btn.setAttribute('hidden', '');
        return;
    }

    sel.innerHTML = '';

    var workouts = userSettings.getAllMyWorkouts().sort(function (a, b) {
        if (a.name > b.name) return 1;
        if (a.name < b.name) return -1;
        if (a.name == b.name) return 0;
    });

    for (var i = 0; i < workouts.length; i++) {
        var option = document.createElement("option");
        option.text = workouts[i].name;
        sel.add(option);
    }
}


function setupCreateWorkoutUrlButton(enable) {
    var buttonSave = document.querySelector('#divButtons > div:nth-child(1)');
    var buttonUrl = document.querySelector('#divButtons > div:nth-child(2)');
    var buttonDownload = document.querySelector('#divButtons > div:nth-child(3)');

    if (enable) {
        buttonSave.classList.remove('u-1-2');
        buttonDownload.classList.remove('u-1-2');
        buttonUrl.classList.remove('display-none');
        buttonSave.classList.add('u-1-3');
        buttonDownload.classList.add('u-1-3');
    } else {
        buttonSave.classList.remove('u-1-3');
        buttonDownload.classList.remove('u-1-3');
        buttonUrl.classList.add('display-none');
        buttonSave.classList.add('u-1-2');
        buttonDownload.classList.add('u-1-2');
    }
}


function getSelectedSegment() {
    var selectedSegment = document.querySelector('#divSegmentChart input:checked');
    if (!selectedSegment) return null;
    return document.querySelector('div[data-id="' + selectedSegment.id + '"]');
}


function loadWorkout(workout) {
    currentWorkout = workout;
    document.getElementById('txtName').value = workout.name;
    document.getElementById('txtDescription').value = workout.description;
    document.getElementById('txtAuthor').value = workout.author;
    document.getElementById('txtTags').value = workout.tags.join(' ');
    document.getElementById('divSegmentChart').innerHTML = '';
    for (var i = 0; i < workout.segments.length; i++) {
        addSegmentToChart(workout.segments[i], true);
    }
}


function populateUserSettings() {
    var checkboxes = document.querySelectorAll('#divModalSettings input[type=checkbox]');
    for (var i = 0; i < checkboxes.length; i++) {
        checkboxes[i].checked = userSettings[checkboxes[i].getAttribute('data-key')];
    }

    var numInputs = document.querySelectorAll('#divModalSettings input[type=number]');
    for (var i = 0; i < numInputs.length; i++) {
        numInputs[i].value = userSettings[numInputs[i].getAttribute('data-key')];
    }
}


function addSegmentToChart(segment, performClick) {
    var svgs = segment.toSvgs(userSettings);
    var div = document.createElement('div');
    div.setAttribute('data-id', segment.id);
    var input = document.createElement('input');
    input.setAttribute('type', 'radio');
    input.setAttribute('id', segment.id);
    input.setAttribute('name', 'segment');
    var label = document.createElement('label');
    label.setAttribute('for', segment.id);
    for (var i = 0; i < svgs.length; i++) {
        label.appendChild(svgs[i]);
    }
    div.appendChild(input);
    div.appendChild(label);
    document.getElementById('divSegmentChart').appendChild(div);
    if (performClick) input.click();
    updateWorkoutDuration();
}


function loadSegmentInfo(segmentId) {
    var txtR = document.getElementById('txtR');
    var txtD1 = document.getElementById('txtD1');
    var txtP1 = document.getElementById('txtP1');
    var txtD2 = document.getElementById('txtD2');
    var txtP2 = document.getElementById('txtP2');
    var chkCadence = document.getElementById('chkCadence');
    var txtC1 = document.getElementById('txtC1');
    var txtC2 = document.getElementById('txtC2');
    var divTexts = document.getElementById('divTextEvents');
    var selected = currentWorkout.segments.find(s => s.id === segmentId);
    var chkShowAvg = document.getElementById('chkShowAvg');
    var chkDisableFlatRoad = document.getElementById('chkDisableFlatRoad');

    if (selected.r) { txtR.value = selected.r; txtR.removeAttribute('disabled'); } else { txtR.value = ''; txtR.setAttribute('disabled', true); }
    if (selected.d2) { txtD2.value = selected.d2; txtD2.removeAttribute('disabled'); } else { txtD2.value = ''; txtD2.setAttribute('disabled', true); }
    if (selected.p2) { txtP2.value = selected.p2; txtP2.removeAttribute('disabled'); } else { txtP2.value = ''; txtP2.setAttribute('disabled', true); }
    if (selected.d1) { txtD1.value = selected.d1; txtD1.removeAttribute('disabled'); } else { txtD1.value = ''; txtD1.setAttribute('disabled', true); }
    if (selected.p1) { txtP1.value = selected.p1; txtP1.removeAttribute('disabled'); } else { txtP1.value = ''; txtP1.setAttribute('disabled', true); }
    if (selected.c1) { txtC1.value = selected.c1; txtC1.removeAttribute('disabled'); chkCadence.checked = true; } else { txtC1.value = ''; txtC1.setAttribute('disabled', true); chkCadence.checked = false; }
    if (selected.c2) { txtC2.value = selected.c2; txtC2.removeAttribute('disabled'); } else { txtC2.value = ''; txtC2.setAttribute('disabled', true); }
    if (selected.avg) chkShowAvg.checked = true; else chkShowAvg.checked = false;
    if (selected.dfr) chkDisableFlatRoad.checked = true; else chkDisableFlatRoad.checked = false;

    updateTimeInMinutes();
    updateAbsolutePower();

    divTexts.innerHTML = '';
    for (var i = 0; i < selected.textEvents.length; i++) {
        addTextEventControls(selected.textEvents[i]);
    }
}


function updateTimeInMinutes() {
    var txtD1 = document.getElementById('txtD1');
    var txtD2 = document.getElementById('txtD2');
    var divD1 = document.getElementById('divD1');
    var divD2 = document.getElementById('divD2');

    if (userSettings.displayTimeInMinutes) {
        if (txtD1.hasAttribute('disabled')) {
            divD1.setAttribute('hidden', '');
        } else {
            divD1.removeAttribute('hidden');
            divD1.innerText = secondsToMinutes(txtD1.value);
        }

        if (txtD2.hasAttribute('disabled')) {
            divD2.setAttribute('hidden', '');
        } else {
            divD2.removeAttribute('hidden');
            divD2.innerText = secondsToMinutes(txtD2.value);
        }
    } else {
        divD2.setAttribute('hidden', '');
        divD1.setAttribute('hidden', '');
    }
}


function updateAbsolutePower() {
    var txtP1 = document.getElementById('txtP1');
    var txtP2 = document.getElementById('txtP2');
    var divP1 = document.getElementById('divP1');
    var divP2 = document.getElementById('divP2');

    divP1.classList.remove('z1', 'z2', 'z3', 'z4', 'z5', 'z6');
    divP2.classList.remove('z1', 'z2', 'z3', 'z4', 'z5', 'z6');

    if (userSettings.displayAbsolutePower) {
        if (txtP1.hasAttribute('disabled')) {
            divP1.setAttribute('hidden', '');
        } else {
            divP1.removeAttribute('hidden');
            divP1.innerText = Math.round(txtP1.value / 100 * userSettings.userFtp) + ' W';
            if (txtP1.value >= 119) divP1.classList.add('z6');
            else if (txtP1.value >= 105) divP1.classList.add('z5');
            else if (txtP1.value >= 90) divP1.classList.add('z4');
            else if (txtP1.value >= 76) divP1.classList.add('z3');
            else if (txtP1.value >= 60) divP1.classList.add('z2');
            else divP1.classList.add('z1');
        }

        if (txtP2.hasAttribute('disabled')) {
            divP2.setAttribute('hidden', '');
        } else {
            divP2.removeAttribute('hidden');
            divP2.innerText = Math.round(txtP2.value / 100 * userSettings.userFtp) + ' W';
            if (txtP2.value >= 119) divP2.classList.add('z6');
            else if (txtP2.value >= 105) divP2.classList.add('z5');
            else if (txtP2.value >= 90) divP2.classList.add('z4');
            else if (txtP2.value >= 76) divP2.classList.add('z3');
            else if (txtP2.value >= 60) divP2.classList.add('z2');
            else divP2.classList.add('z1');
        }
    } else {
        divP1.setAttribute('hidden', '');
        divP2.setAttribute('hidden', '');
    }
}


function loadNoSegment() {
    var txtR = document.querySelector('#txtR');
    txtR.value = '';
    txtR.setAttribute('disabled', true);
    var txtD1 = document.querySelector('#txtD1');
    txtD1.value = '';
    txtD1.setAttribute('disabled', true);
    var txtP1 = document.querySelector('#txtP1');
    txtP1.value = '';
    txtP1.setAttribute('disabled', true);
    var txtD2 = document.querySelector('#txtD2');
    txtD2.value = '';
    txtD2.setAttribute('disabled', true);
    var txtP2 = document.querySelector('#txtP2');
    txtP2.value = '';
    txtP2.setAttribute('disabled', true);
}


function showModal(id) {
    var overlay = document.createElement('div');
    overlay.setAttribute('class', 'overlay');
    document.body.appendChild(overlay);
    document.getElementById(id).classList.add('shown');
}


function dismissModal() {
    var modal = document.querySelector('.modal.shown');
    modal.classList.remove('shown');
    var overlay = document.querySelector('.overlay');
    overlay.parentNode.removeChild(overlay);
}


function addTextEventControls(textEvent) {
    var clone = document.getElementById('divTextEventToClone').cloneNode(true);
    clone.classList.remove('invisible');
    document.getElementById('divTextEvents').appendChild(clone);
    var childNodes = document.getElementById('divTextEvents').childNodes;
    var addedElement = childNodes[childNodes.length - 1];
    addedElement.setAttribute('id', textEvent.id);
    addedElement.querySelector('input').value = textEvent.text;
    addedElement.querySelector('input[type=number]').value = textEvent.offset;
    addedElement.querySelector('input').select();
}


function updateWorkoutDuration() {
    document.getElementById('spanWorkoutDuration').innerHTML = currentWorkout.calculateDuration();
    if (userSettings.displayTss) document.getElementById('spanTss').innerHTML = currentWorkout.calculateScore();
    if (userSettings.displayXp) document.getElementById('spanXp').innerHTML = currentWorkout.calculateXp() + " XP";
}


function secondsToMinutes(seconds) {
    var dt = new Date(null);
    dt.setSeconds(seconds);
    var str = dt.toISOString().substr(11, 8);
    if (seconds < 36000) str = str.substr(1);
    if (seconds < 3600) str = str.substr(2);
    if (seconds < 600) str = str.substr(1);
    return str;
}