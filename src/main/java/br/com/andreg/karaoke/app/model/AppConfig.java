package br.com.andreg.karaoke.app.model;

import java.util.ArrayList;
import java.util.List;

public class AppConfig {
    public List<String> pastas = new ArrayList<>();
    public String audioDeviceId = ""; 
    public String videoOutputMode = "Monitor"; // "Monitor" ou "NDI"
    public String displayId = "0"; // "0" para Monitor 1, "1" para Monitor 2, etc.
}