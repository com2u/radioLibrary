# Extended Development Requirements for the Radio Library Application

## Overview

The following points define additional and extended development requirements for the **Clip Mode**, the **general UI behavior**, the **metadata handling**, the **community rating logic**, the **song list interaction model**, the **keyboard shortcuts**, and a new **recording control interface** accessible from the top bar. Nothing from the provided specification is omitted below; all requirements are retained and described in English in detailed Markdown form.

---

## Extended Requirements for Clip Mode

### Replace Clip Text Buttons with Icons

For the **Clip-Right** and **Clip-Left** actions, use **icons instead of text labels**. The goal is to make the interface cleaner and more intuitive in Clip Mode. Even though the visible label should be replaced by an icon, the action must remain clearly understandable through supporting UI cues such as tooltips.

### Waveform Zoom in Clip Mode

Clip Mode must provide a **zoom function for the waveform**. The waveform should support zooming in and out so that the user can more precisely identify the exact clipping point.

The zoom interaction should include:

- a **magnifying glass icon with a plus symbol** for zooming in
- a **magnifying glass icon with a minus symbol** for zooming out
- a **horizontal scrollbar** that becomes usable when the waveform is zoomed in, allowing navigation to the left and right across the waveform

This is required so that the user can more easily and accurately select the exact point at which clipping should occur.

### Fade Visualization as Waveform Overlay

In cases where:

- **Fade In** and **Fade Out** are both active,
- or only **one of the two** is active,

the waveform must show the fade region(s) as an **overlay**. This overlay should make it visually understandable approximately how long the fade is and where it is located within the waveform. The user must be able to infer the approximate duration and position of the applied fade directly from the waveform representation.

### Delete Button in Clip Mode

In addition to the existing **Save** action, add a **Delete** button in Clip Mode. This Delete button must allow the user to delete the file directly from within Clip Mode.

The Delete action must also allow the user to leave Clip Mode afterward. In other words, deletion from Clip Mode should also function as an exit path from the mode.

### ID3 Comment Update on Save

When a file is saved in Clip Mode, and the **comment field in the ID3 tags is still empty**, automatically write the word:

saved

into the ID3 tag comments. This is required so the user can later recognize that this clip has already been edited.

This update must only happen when:

- the file is being saved from Clip Mode
- and the ID3 tag comments are empty

If the comment field already contains text, the requirement only states that the word saved should be inserted if the comment is still empty.

---

## Additional Clip Mode Shortcuts

Add the following keyboard shortcuts specifically for **Clip Mode** to simplify operation:

- **Delete key**: deletes the file
- **S key**: saves the file
- **L key**: toggles **Fade In**, meaning the fade on the **left side**
- **R key**: shortcut for **Fade Out** or **Fade Right**
- **M key**: opens metadata editing

These shortcuts must function while the user is in Clip Mode and should support a faster editing workflow without relying solely on mouse interaction.

---

## General UI Requirements

### Tooltips for All Icon Buttons

All buttons that use only an **icon** must provide a **tooltip** that shows the fully written-out function name. This applies across:

- **Clip Mode**
- **Play Mode**
- **Song List**

The tooltip must clearly describe the function behind the icon so that the UI remains understandable and accessible even when text labels are reduced.

### Rename “Edit” to “Metadata”

Rename the button currently labeled **Edit** to:

**Metadata**

The reason is that the button does not perform generic editing, but specifically edits metadata. This rename must be applied consistently wherever the button appears.

---

## Metadata Enhancements

### Add Created Date and Time

Inside the metadata view, add the file’s:

- **Created Date**
- **Created Time**

This is required so that the user can see when the file was originally created.

The metadata editing or display interface should therefore not only show the file path, title, metadata, and ID3 tags, but also include the creation date and time for the file.

---

## Community Rating Enhancements

### Star-Based Community Rating in Play and Clip Mode

Add a **star rating UI** for the **community rating** in both:

- **Play Mode**
- **Clip Mode**

If the community rating is empty, then **no stars should be shown as active**. In that case, the star control should visually indicate that no rating has been set yet.

The control must always provide **5 stars**.

The stars should be positioned **next to the heart icon**.

### Mapping Between Stars and Community Rating

The star selection must map to the numeric community rating values as follows:

- selecting **1 star** sets the community rating to **1**
- selecting **2 stars** sets the community rating to **3**
- selecting **3 stars** sets the community rating to **5**
- selecting **4 stars** sets the community rating to **7**
- selecting **5 stars** sets the community rating to **9**

This mapping must be implemented exactly as described.

### Song List Rating Interaction

There is also an additional interaction requirement for the song list related to the stars. When pressing a star, the community rating must be adjusted.

For each star that is pressed once, the community rating should be increased.

If all stars are already full and a star is pressed again, then:

- remove the community rating
- otherwise begin counting again from the start

This requirement should be implemented carefully so that the interaction in the song list cycles through the rating states in a predictable way.

---

## Song List Enhancements

### Correct Unicode Rendering for Special Characters

In the song list, the **title**, **artist**, and **album** are sometimes not displayed correctly when they contain **special characters**. Use a clean and correct **Unicode representation** that properly handles:

- special characters
- umlauts
- other non-ASCII characters

The display layer and any backend-to-frontend transfer must therefore support proper Unicode handling to ensure these fields are shown correctly.

---

## Additional Song List Shortcuts

Add the following keyboard shortcuts specifically for the **Song List**:

- **C key**: starts **Clip Mode**
- **M key**: opens **metadata editing**
- **Delete key**: deletes the currently selected file, but only after showing a **confirmation dialog**
- **F key**: opens the **filter dialog**
- **O key**: opens the **sort order dialog**

In addition, pressing a **star** in the song list must adjust the community rating according to the rating logic described above.

These shortcuts must apply to the currently selected item in the song list where relevant.
