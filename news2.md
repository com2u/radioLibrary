## Adjustments to the Song Player and Song List

### Continue Playback Across Paged Song List Views

When a song is being played from the **song list page**, and playback reaches the **end of the currently displayed page**, the player must continue with the songs on the **next page**, meaning the next block of **100 songs**. At the same time, the song list view must be updated so that it switches to the next page accordingly.

This behavior must not be limited to automatic playback progression only. It must also apply when song playback is controlled through song navigation actions such as:

- **Arrow Down** to move to the next song
- **Arrow Up** to move to the previous song

If the end of the currently displayed song list page has been reached while navigating forward, the interface must continue on the **next song list page**. Likewise, when navigating backward and the beginning of the current page has been reached, the system must go to the **previous page** and continue there. This is required to ensure that the **entire song list can be played through completely**, even when paging splits the song list into multiple subpages.

---

## Playlist Integration

### Existing Playlists in the Radio Directory

Inside the directory named **“Radio”**, there is **one playlist or multiple playlists**. These playlists are created in **M3U8 format**. The application must integrate these playlists into the player workflow.

### Add Playlist Button

Add a button labeled **Playlist** to the player. This button may be placed in the **player**, in the **clip view**, or in the **playlist-related interface**, as described in the transcript. When this button is pressed, the application must open a selection of the available playlists and allow the user to add the **current song** to the selected playlist. The playlists are named similar to the playlist filename without extension. 

This means the system must:

- read available playlists from the relevant location
- display them as selectable options
- append or insert the current song into the selected playlist in M3U8 format

---

## Playlist Shortcuts

To simplify operation, keyboard shortcuts must be added for playlist assignment:

- pressing **A** adds the current song to the **first playlist**
- pressing **B** adds the current song to the **second playlist**

These shortcuts are specifically intended to make adding songs to playlists faster and more convenient during playback or editing workflows.

---

## Additional Shortcut for Star / Rating Assignment

There is also an additional shortcut requirement for setting stars. The system must use the **number keys** for setting the rating. The transcript states:

- use the number keys **1, 2, 3 up to 9**
- depending on which number key is pressed, set the **community rating** to exactly that numeric value

That means:

- pressing **1** sets the community rating to **1**
- pressing **2** sets the community rating to **2**
- pressing **3** sets the community rating to **3**
- and so on up to **9**

This is a direct numeric shortcut assignment for the community rating value and must be implemented exactly as described.

---

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

---

## Testing Requirements

The transcript explicitly requests that the newly added functions be tested. In particular:

- test the added station editing functions
- test the addition of a new streaming service using the example **Vintage Radio**

Name: Vintage Radio 
URL: https://vintageradio.ice.infomaniak.ch/vintageradio-high.mp3 
Path: VINTAGE

Name: Vintage Radio 80er 
URL: https://vintage80s.ice.infomaniak.ch/vintage80s-high.mp3
Path: VINTAGE80

This means the development process must include verification that:

1. station configuration editing works correctly,
2. default activation can be set,
3. name, stream URL, and folder can be maintained,
4. relative folder handling works correctly,
5. and a new station can actually be added using **Vintage Radio** as a concrete test example. 
 
This will result in an update of the station list, new /mnt/radio/inbox path, new path in /mnt/radio/music.

 
