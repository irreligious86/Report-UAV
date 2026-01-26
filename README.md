# Report UAV

Report UAV is a lightweight web application for creating structured UAV mission reports directly in the browser.

The project is designed for fast field reporting, mobile devices, and offline usage.  
All data is stored locally on the user's device and is not sent to any server.

## Features

- Create UAV mission reports using structured forms
- Optimized for mobile phones and tablets
- Works offline (PWA-ready architecture)
- Local data storage (no backend required)
- Automatic date and time handling
- Configurable report fields via JSON
- Export-ready text output

## Use cases

- UAV mission reporting
- Field notes for drone operations
- Training and test flight documentation
- Any situation where fast, structured reporting is required

## Project structure
/ ├── index.html        # Main application page ├── styles.css        # Application styles ├── app.js            # Core logic ├── config.json       # Editable configuration and lists ├── manifest.webmanifest (optional) └── README.md
Copy code

## Configuration

All selectable lists and templates are stored in `config.json`.  
You can edit this file to adapt the application to your specific workflow or terminology.

## Privacy

This application does not collect, transmit, or store data on any external servers.  
All information remains on the user's device.

## Status

Project is under active development.  
The structure is stable, functionality may be expanded.

## License

MIT License