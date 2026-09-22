# Project and Development Description: Radio Library Application

## Overview

This project is a **Radio Library** application consisting of both a **backend** and a **frontend**. In the development environment, the backend and frontend must each be placed in their **own separate folder**. The Application will be located in ~/src/radio/. The backend must access a **music directory** that contains radio streams and music files recorded from radio broadcasts. The music is located in /mnt/radio/music. This directory includes **subfolders** and represents the complete music library. The music files are **MP3 files** containing **ID3 tag information**. The frontend must provide a modern web interface in which the user can browse this music library and play songs.

The goal is to create an application that makes it easy to **play, sort, filter, and trim music clips recorded from radio**, so that spoken passages or poor transitions can be manually removed. The application must also be tested thoroughly at the end, including both the backend and all frontend functionalities. The UI and UX must be reviewed to ensure a **logical and simple user experience**. The final application should have an **appealing design**, use **as much screen width as possible**, and provide a **modern look and feel** suitable for use in modern **Chrome browsers**.

---

## System Architecture

## Backend

The backend is responsible for accessing a fixed music folder that contains the full radio-recorded music library. This library is organized in subfolders and contains MP3 files with ID3 text metadata. The backend must scan these files and retrieve all available ID3 information from them. This includes all metadata necessary for filtering, displaying, editing, and playback support within the frontend. The backend always retrieves its music from the **same directory**.

The backend must also support editing metadata and ID3 tags, preserving those tags even when a song is updated after clip editing. It must enable the frontend to display the real file path, title, and metadata when the user enters metadata editing mode.

## Frontend

The frontend is a modern web application for navigating and interacting with the music library. It must present all music files in a default overview and provide a clean, modern interface that allows the user to browse, filter, play, and edit songs. It should use the full width of the browser window wherever possible, especially for the waveform and clipping interface, so that detailed waveform interaction is easy and intuitive.

---

## Music Library Browsing and Default View

The default view of the web interface must show **all music files** as entries in a **table or list**. The user should be able to browse the complete music library immediately upon loading the application. The primary main view is the **song list**, and this list must be presented as a **clear and attractive table** in which **each song occupies one row**.

Each row in the song table must display the relevant information in a structured way:

- the **title**
- the **artist**, shown underneath the title
- a **favorite or like indicator**, represented by a heart icon
- the **duration** of the song
- the **community rating** as a numeric value
- the **genres** assigned to the song from the ID3 tags
- the **text** from the ID3 tags
- an **Edit button** for changing metadata and ID3 tags

A simple click on a song in the list must immediately start playback of that song. The table must also visually indicate **which song is currently playing**. The list should display **a maximum of 100 songs at a time**. If there are more than 100 songs, the interface must provide **paging**, allowing the user to jump through the song collection in increments of one hundred.

---

## Filtering Functionality

The interface must include a **filter function** with multiple filtering options. The filter should support both **full-text searching** and **structured selection via checkboxes**.

### Full-text search

The user must be able to search using full-text search across the following fields:

- filename or name
- title
- artist
- album

### Checkbox-based filters

The user must also be able to search using checkbox selections based on information derived from the ID3 tags and related metadata, including:

- favorites
- likes
- year
- genre
- text
- community ratings

The system must **scan and create a list of all ID3 information from all existing music files**, specifically so that available **genres** and **tags/text values** can be presented as selectable checkbox filter options. This allows the user to select from all existing genres and text values directly in the filter UI.

The filter dialog must provide the following actions:

- **Save**: activates the filter and restricts the table to only the matching filter options
- **Reset**: clears all filter settings
- **Cancel**: closes the dialog without applying any changes

The transcript explicitly notes that when all filter parameters are entered, the filter can be activated via Save, and the song table is then limited to only those entries matching the selected filter settings. Reset restores the filter state to default, while Cancel leaves the dialog without changing anything.

---

## Song Playback Interface

Below the song list there must be a **playback control interface** for playing a song. This playback area must include a **waveform representation** of the current song. Within this waveform, there must be a **cursor** or **play marker** that shows the current playback position. The user must be able to move this marker manually in order to jump to a different position within the song.

The playback area must display:

- the **song title**
- the **artist** underneath the title
- a set of navigation icons
- a **favorite or like** heart icon
- controls for **Previous**
- **Play/Stop**
- **Next**
- the **current playback time**
- the **total song duration**
- a **volume slider** to adjust playback volume
- an **Edit button** to edit ID3 information and metadata
- a **Clip button** to switch into editing mode for trimming the song

---

## Hotkeys and Keyboard Interaction

For ease of use, the application must support **keyboard shortcuts**. The following hotkeys are required:

- **Enter** or **Spacebar**: start or stop playback
- **Arrow Up**: play the previous song
- **Arrow Down**: play the next song
- **Arrow Right**: jump forward by 10 seconds in the current title
- **Arrow Left**: jump backward by 10 seconds in the current title

These hotkeys are intended to improve usability and make interaction with the song list and player more efficient.

---

## Clip Mode

When the user presses the **Clip button**, the application must enter **Clip Mode**. In this mode, the song display is extended. The transcript specifies that Clip Mode is fundamentally based on the same display as the play view for a song, but with additional buttons and editing capabilities for clipping and fading.

### Clip Mode controls

In Clip Mode:

- the **Previous** button is replaced with **Clip Left**
- the **Next** button is replaced with **Clip Right**

#### Clip Left

Clip Left deletes everything **to the left of the current play marker / cursor**. In other words, it removes all material from the beginning of the song up to the current cursor position.

#### Fade In

After Clip Left, there must be a **Fade In** option. If Fade In is selected, the beginning of the song is faded in. The transcript specifies that this is a fade field of **3 seconds** from the beginning of the clip.

#### Clip Right

Clip Right deletes everything **to the right of the current play marker**. This removes all material from the cursor position to the end of the song.

#### Fade Out

After Clip Right, there must be a **Fade Out** option. Fade Out fades out the **last 3 seconds** of the music piece.

### Waveform updates in Clip Mode

The waveform display must indicate **where clipping is applied**. In addition, the waveform must be updated when **Fade In** or **Fade Out** has been selected. The user must be able to play the clip inside Clip Mode in order to immediately hear how the changes affect the audio.

However, these clip changes must **not be stored directly in the original file immediately**. Instead, they should be **stored or cached locally** until the user decides whether to save or cancel them.

### Save and Cancel behavior in Clip Mode

- If the user presses **Cancel**, the clip is not modified and Clip Mode is exited.
- If the user presses **Save**, the song is updated and retains its ID3 tags.

The purpose of this mode is explicitly to make it possible to trim songs so that **spoken text or poor overlays/transitions** can be manually cut out.

---

## Metadata Editing

Metadata editing must be available both:

- from the **Play Song mode**
- and from the **Song List**

When the user enters metadata editing, the application must display:

- the **actual file path**
- the **file title**
- the **metadata**
- the **ID3 tags**

The metadata and ID3 tags must be editable in a way that is **easy to understand** and **logical to use**.

---

## UI and UX Requirements

The application must be designed to be:

- **logically structured**
- **easy to operate**
- **visually appealing**
- **modern in appearance**
- optimized for **modern Chrome browsers**

The layout should make use of **as much horizontal screen space as possible**, especially for the waveform display and clipping features. The waveform and clipping interface should span nearly the full width of the screen to maximize usability and precision during audio editing.

---

## Testing and Quality Assurance

At the end of development, the application must be tested comprehensively. This includes:

- testing the **backend**
- testing all **frontend functionalities individually**
- checking the **UI**
- checking the **UX**
- verifying that the workflow is **logical and easy to use**

The final result should be an application that reliably supports:

- browsing a radio-recorded music archive
- playing songs directly
- filtering and sorting the song collection
- editing metadata and ID3 tags
- clipping songs
- removing spoken text or poor radio overlays manually
- interacting with the system in a modern, full-width web interface

