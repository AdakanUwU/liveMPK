// Funkcja do ładowania plików JSON
async function loadJSONData(fileName) {
    try {
        const response = await fetch(fileName);
        if (!response.ok) {
            throw new Error(`Błąd ładowania pliku ${fileName}: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(error);
        return null;
    }
}

// Inicjalizacja danych
let linesData = [];
let directionsData = [];
let vehiclesData = [];
let databaseData = [];

// Funkcja ładowania wszystkich danych JSON
async function loadAllData() {
    linesData = await loadJSONData('lines.json');
    directionsData = await loadJSONData('directions.json');
    vehiclesData = await loadJSONData('vehicles.json');
    databaseData = await loadJSONData('database.json');
    
    console.log('Dane zostały załadowane:', {
        linesData,
        directionsData,
        vehiclesData,
        databaseData
    });
}

// Funkcja do pobierania rozkładów jazdy z API MPK
async function fetchTimetable(fullUrl) {
    let formattedDate = ''; // Zmienna na datę

    // Sprawdzenie, czy URL jest skrócony
    if (fullUrl.includes('#/busstops/')) {
        const busStopId = fullUrl.split('/').pop(); // Ekstrahujemy ID przystanku
        const currentDate = new Date(); // Uzyskujemy aktualną datę
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Miesiące są liczone od 0
        const day = String(currentDate.getDate()).padStart(2, '0');

        // Tworzymy pełny link
        fullUrl = `https://live.mpk.czest.pl/api/locations/${busStopId}/timetables/${year}/${month}/${day}`;
        formattedDate = `${day}-${month}-${year}`; // Przechowujemy poprawną datę

        console.log("Skrócony link wykryty. Nowy link:", fullUrl); // Logowanie do konsoli
    } else {
        // Jeśli użyto pełnego linku, wydobywamy datę z URL
        const urlParts = fullUrl.split('/');
        const year = urlParts[urlParts.length - 3];
        const month = urlParts[urlParts.length - 2];
        const day = urlParts[urlParts.length - 1];
        formattedDate = `${day}-${month}-${year}`; // Formatowanie daty DD-MM-RRRR
    }

    try {
        const response = await fetch(fullUrl);
        if (!response.ok) {
            throw new Error(`Błąd podczas pobierania danych z API MPK. Status: ${response.status}`);
        }

        const data = await response.json();

        // Przetwarzanie danych w podobny sposób jak na serwerze
        const formattedData = data.map(item => ({
            lineID: item.lineID,
            vehicles: item.timetable.map(t => ({
                vehicleID: t.vehicleID,
                direction: t.direction,
                sideNo: t.sideNo,
                dateTime: t.dateTime
            }))
        }));

        const resultWithNames = formattedData.map(item => {
            const line = linesData.find(line => line.lineID === item.lineID);
            const vehiclesWithNames = item.vehicles.map(v => {
                const vehicle = vehiclesData.find(vh => vh.vehicleID === v.vehicleID); // Pobieramy dane pojazdu z vehicles.json
                const sideNo = vehicle?.sideNo || 'Nieznany numer taborowy'; // Pobieramy numer taborowy

                // Teraz znajdźmy model na podstawie sideNo
                const vehicleModel = getModelBySideNo(sideNo) || 'Nieznany model'; // Dopasowanie na podstawie sideNo

                return {
                    vehicleID: v.vehicleID,
                    direction: directionsData.find(dir => dir.locationID === v.direction)?.name || v.direction,
                    sideNo: sideNo, // Numer taborowy z vehicles.json
                    model: vehicleModel, // Model na podstawie sideNo
                    dateTime: v.dateTime // Dodano dateTime
                };
            });

            return {
                lineName: line ? line.name : item.lineID,
                vehicles: vehiclesWithNames
            };
        });

        console.log('Otrzymane i przetworzone dane:', resultWithNames);
        return {
            date: formattedDate, // Dodanie poprawnej daty
            data: resultWithNames
        };
    } catch (error) {
        console.error('Błąd:', error);
    }
}

// Funkcja do wyszukiwania modelu pojazdu na podstawie numeru taborowego (sideNo)
function getModelBySideNo(sideNo) {
    const sideNumbers = sideNo.split('/'); // Dzielimy na wagon przedni i tylny
    let model = null;

    // Szukamy modelu dla przedniego wagonu
    if (sideNumbers.length > 0) {
        const frontWagon = sideNumbers[0].trim(); // Numer przedniego wagonu
        model = databaseData.find(db => db.sideNo === frontWagon)?.model;
    }

    // Jeśli nie znaleziono modelu dla przedniego wagonu, sprawdzamy tylny
    if (!model && sideNumbers.length > 1) {
        const rearWagon = sideNumbers[1].trim(); // Numer tylnego wagonu
        model = databaseData.find(db => db.sideNo === rearWagon)?.model;
    }

    return model || 'Nieznany model';
}

// Funkcja, która będzie używana do wyświetlania rozkładów na stronie
async function displayTimetables(url) {
    const timetableData = await fetchTimetable(url);

    if (timetableData) {
        const { date, data } = timetableData;

        // Tutaj możesz dodać kod do aktualizacji interfejsu strony, np. wyświetlanie danych w HTML
        console.log(`Dane dla daty: ${date}`, data);
        // Przykładowo, można zaktualizować HTML z rozkładem:
        const timetableContainer = document.getElementById('timetable-container');
        timetableContainer.innerHTML = `<h3>Rozkład jazdy z dnia: ${date}</h3>`;

        data.forEach(line => {
            const lineElement = document.createElement('div');
            lineElement.innerHTML = `<h4>Linia: ${line.lineName}</h4>`;
            line.vehicles.forEach(vehicle => {
                lineElement.innerHTML += `
                    <p>Pojazd: ${vehicle.sideNo} (${vehicle.model}), Kierunek: ${vehicle.direction}, Czas: ${vehicle.dateTime}</p>
                `;
            });
            timetableContainer.appendChild(lineElement);
        });
    } else {
        console.error('Nie udało się pobrać danych rozkładu.');
    }
}

// Inicjalizacja po załadowaniu strony
document.addEventListener('DOMContentLoaded', async () => {
    await loadAllData();

    // Obsługa formularza do wyszukiwania rozkładów
    const form = document.getElementById('timetable-form');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const urlInput = document.getElementById('url-input').value;
        await displayTimetables(urlInput);
    });
});
