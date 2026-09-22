## Recording Control Dialog

### New Dialog for Recording Control

Add a new dialog specifically for **controlling recordings**. This dialog must be opened through the new **Gear icon** in the top bar.

The purpose of this dialog is to let the user control **Radio Capture** for the different channels or stations.

### Use Hermes Skills Requirements

The requirement explicitly states that you should look at the **Hermes Skills** to determine what is necessary to implement this functionality. That means the recording control dialog and its behavior must be aligned with whatever mechanisms, commands, integrations, or operational assumptions are required by the relevant Hermes-related setup.

### Start and Stop Recording from the UI

The user must be able to:

- **start recording**
- **stop recording**

directly from the interface.

The intended behavior is that streams can be recorded via the **cron job**, or the recording job can be stopped through the interface.

### Per-Station Control

The recording control must work **for each available station individually**. The user must be able to:

- activate recording for individual stations
- deactivate recording for individual stations
- restart the service

This per-stream or per-station granularity is explicitly required.

---

## Recording Statistics View

The recording control interface must also display **statistics**. This statistics section must include the following information:

### Total Number of Songs in the Library

Show the **total number of songs currently present in the music library**.

### Recently Recorded Counts

Show:

- the number of songs recorded **today**
- the number of songs recorded in the **last 30 minutes**

For the “today” and “last 30 minutes” values, the display must include:

- a **per-stream view**, showing the values for each individual stream
- an **accumulated view**, summing the values across all streams

This means the statistics view must present both granular and aggregated recording numbers.

---

## Navigation Back to Song List

When the user clicks the icon or the text:

**Radio Library**

in the top-left area, the application must navigate back to the **song list** and show the **Play Mode** view again.

This provides a direct navigation shortcut back to the main library interface.


## Recording and Recording Control Enhancements

### Existing Recording Control Page

The transcript states that recordings can currently already be:

- started
- stopped
- and statistics can be viewed

through a separate interface or dedicated page.

### Add Editing Functionality for Radio Stations

On this recording control page, add an **editing function for the radio stations** and for the **default activation** settings. This means the recording management view must not only control recordings operationally, but also allow configuration of the radio station definitions themselves.

For each radio station, the user must be able to define:

- a **name**
- the **stream URL**
- the **folder** where the recordings for that station are stored

### Relative Folder Support

The folder should be allowed to be a **relative folder path**. The reason stated in the transcript is that this folder should be usable both for:

- the **recording process**
- and later for **sorting/importing into the music library**

This means the folder configuration is not only a storage path for capturing streams, but also part of the later music organization workflow.

### Default Activation

The station editing view must also include support for **default activation**, meaning it must be possible to define whether a radio station is active by default in the recording setup.
