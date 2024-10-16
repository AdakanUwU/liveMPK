const baseUrl = 'https://adakanuwu.github.io/liveMPK/'; // URL do repozytorium GitHub Pages

const linesUrl = `${baseUrl}/lines.json`;
const directionsUrl = `${baseUrl}/directions.json`;
const vehiclesUrl = `${baseUrl}/vehicles.json`;
const databaseUrl = `${baseUrl}/database.json`;

const fetchBusStopData = async (busStopId) => {
    const response = await fetch(`${baseUrl}/directions.json`); // Pobieranie z hostowanego pliku JSON
    if (!response.ok) {
        console.error("Błąd wczytywania directions.json");
        return null;
    }
    const data = await response.json();
    const busStop = data.find(stop => stop.locationID === busStopId);
    return busStop ? { name: busStop.name, description: busStop.description } : null;
};

const fetchData = async (url, dateOverride = null) => {
    let requestUrl = url;
    let busStopName = '';
    let busStopDescription = '';

    if (url.includes('#/busstops/')) {
        const busStopId = url.split('/').pop();
        const currentDate = dateOverride || new Date();
        const { year, month, day } = formatDate(currentDate);

        const busStopData = await fetchBusStopData(busStopId);
        if (busStopData) {
            busStopName = busStopData.name;
            busStopDescription = busStopData.description;
        }
        
        requestUrl = `https://live.mpk.czest.pl/api/locations/${busStopId}/timetables/${year}/${month}/${day}`;
        console.log("Skrócony link wykryty. Nowy link:", requestUrl);
    }

    // Pobieranie danych z API MPK
    const response = await fetch(requestUrl);
    if (!response.ok) {
        document.getElementById('output').innerHTML = `<p style="color: red;">Błąd: ${response.status} - ${response.statusText}</p>`;
        return;
    }

    const { date, data } = await response.json();
    console.log("Dane z API:", data);
    
    // Wyświetlanie danych
    displayBusData(date, data, busStopName, busStopDescription);
};

const displayBusData = (date, data, busStopName, busStopDescription) => {
    const container = document.getElementById('bus-lines-container');
    container.innerHTML = '';

    if (busStopName) {
        const busStopInfo = document.createElement('div');
        busStopInfo.innerHTML = `<h2>Przystanek: ${busStopName} <span class="bus-stop-description">${busStopDescription}</span></h2>`;
        container.appendChild(busStopInfo);
    }

    if (date) {
        const dateHeader = document.createElement('h2');
        dateHeader.innerText = `Data: ${date}`;
        container.appendChild(dateHeader);
    }

    const vehicleMap = {};
    data.forEach(item => {
        item.vehicles.forEach(vehicle => {
            const line = item.lineID;
            if (!vehicleMap[line]) vehicleMap[line] = [];
            vehicleMap[line].push(vehicle);
        });
    });

    // Wyświetlanie linii i brygad
    for (const line in vehicleMap) {
        const lineDiv = document.createElement('div');
        lineDiv.innerHTML = `<h3>Linia ${line}</h3>`;
        vehicleMap[line].forEach(vehicle => {
            lineDiv.innerHTML += `${vehicle.sideNo || 'Nieznany'} > ${vehicle.direction}<br>`;
        });
        container.appendChild(lineDiv);
    }
};

// Ustawienia daty i zdarzenie przycisku
document.getElementById('fetchDataButton').addEventListener('click', () => {
    const url = document.getElementById('urlInput').value;
    const selectedDate = document.getElementById('datePicker').value;
    let date = null;
    if (selectedDate) {
        date = new Date(selectedDate);
    }
    fetchData(url, date);
});
