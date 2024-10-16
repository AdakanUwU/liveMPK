// Funkcje do ładowania danych z plików JSON
const loadLinesData = async () => {
    const data = await fs.readFile(path.join(__dirname, 'lines.json'), 'utf-8');
    linesData = JSON.parse(data);
};

const loadDirectionsData = async () => {
    const data = await fs.readFile(path.join(__dirname, 'directions.json'), 'utf-8');
    directionsData = JSON.parse(data);
};

const loadVehiclesData = async () => {
    const data = await fs.readFile(path.join(__dirname, 'vehicles.json'), 'utf-8');
    vehiclesData = JSON.parse(data);
};

const loadDatabaseData = async () => {
    const data = await fs.readFile(path.join(__dirname, 'database.json'), 'utf-8');
    databaseData = JSON.parse(data);
};

// Ładowanie danych przy uruchomieniu serwera
Promise.all([
    loadLinesData(),
    loadDirectionsData(),
    loadVehiclesData(),
    loadDatabaseData()
])
.then(() => {
    console.log('Dane linii, kierunków, pojazdów oraz bazy danych zostały załadowane.');
})
.catch(err => {
    console.error('Błąd podczas ładowania danych:', err);
});

// Obsługa zapytań proxy dla API MPK
app.get('/api/timetables', async (req, res) => {
    let { url: fullUrl } = req.query;
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
        console.log('Status odpowiedzi:', response.status); 

        if (!response.ok) {
            console.error('Błąd podczas pobierania danych:', response.statusText); 
            return res.status(response.status).send(`Błąd podczas pobierania danych z API MPK. Status: ${response.status}`);
        }

        const data = await response.json();

        console.log('Otrzymane dane:', data); 

        // Wydobycie tylko potrzebnych informacji
        const formattedData = data.map(item => {
            // Logowanie, aby zobaczyć, czy dateTime istnieje w obiektach
            console.log(`Przetwarzanie pojazdu: ${JSON.stringify(item)}`);

            return {
                lineID: item.lineID,
                vehicles: item.timetable.map(t => ({
                    vehicleID: t.vehicleID,
                    direction: t.direction,
                    sideNo: t.sideNo, // Dodano sideNo
                    dateTime: t.dateTime // Dodano dateTime
                }))
            };
        });

        // Dodanie nazw linii i kierunków
        const resultWithNames = formattedData.map(item => {
            const line = linesData.find(line => line.lineID === item.lineID);
            const vehiclesWithNames = item.vehicles.map(v => {
                const vehicle = vehiclesData.find(vh => vh.vehicleID === v.vehicleID); // Pobieramy dane pojazdu z vehicles.json
                const sideNo = vehicle?.sideNo || 'Nieznany numer taborowy'; // Pobieramy numer taborowy

                // Teraz znajdźmy model na podstawie sideNo
                const vehicleModel = getModelBySideNo(sideNo) || 'Nieznany model'; // Dopasowanie na podstawie sideNo

                // Logujemy dateTime
                console.log(`Data i czas dla pojazdu ${v.vehicleID}: ${v.dateTime}`);

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

        res.json({
            date: formattedDate, // Dodanie poprawnej daty
            data: resultWithNames
        });
    } catch (error) {
        console.error('Błąd:', error); 
        res.status(500).send('Wystąpił błąd: ' + error.message);
    }
});

// Funkcja do wyszukiwania modelu na podstawie sideNo
const getModelBySideNo = (sideNo) => {
    console.log(`Wyszukiwanie modelu dla numeru taborowego: ${sideNo}`); // Logowanie numeru taborowego

    const sideNumbers = sideNo.split('/'); // Dzielimy na wagon przedni i tylny
    let model = null;

    // Szukamy modelu dla przedniego wagonu
    if (sideNumbers.length > 0) {
        const frontWagon = sideNumbers[0].trim(); // Numer przedniego wagonu
        model = databaseData.find(db => db.sideNo === frontWagon)?.model;
        console.log(`Sprawdzam wagon przedni: ${frontWagon}, model: ${model || 'Nie znaleziono'}`); // Logowanie wyniku
    }

    // Jeśli nie znaleziono modelu dla przedniego wagonu, sprawdzamy tylny
    if (!model && sideNumbers.length > 1) {
        const rearWagon = sideNumbers[1].trim(); // Numer tylnego wagonu
        model = databaseData.find(db => db.sideNo === rearWagon)?.model;
        console.log(`Sprawdzam wagon tylny: ${rearWagon}, model: ${model || 'Nie znaleziono'}`); // Logowanie wyniku
    }

    return model || null; // Zwracamy model lub null
};
