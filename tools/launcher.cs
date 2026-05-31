using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;

class Launcher {
    static void Main(string[] args) {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        string projectDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);

        Console.WriteLine();
        Console.WriteLine(" RL Overlay Studio v2.0.0 - Lanceur");
        Console.WriteLine(" ===================================");

        int[] ports = { 5173, 5174, 49124 };
        foreach (int port in ports) {
            KillPort(port);
        }

        Console.WriteLine(" [>>] Demarrage de rl-overlay-studio...");
        Console.WriteLine();

        var psi = new ProcessStartInfo("cmd.exe", "/c npm run dev") {
            WorkingDirectory = projectDir,
            UseShellExecute = false,
        };

        try {
            var proc = Process.Start(psi);
            proc.WaitForExit();
        } catch (Exception e) {
            Console.WriteLine(" [ERREUR] Impossible de lancer npm : " + e.Message);
            Console.WriteLine(" Verifiez que Node.js et npm sont dans votre PATH.");
            Console.WriteLine(" Appuyez sur une touche pour quitter...");
            Console.ReadKey();
        }
    }

    static void KillPort(int port) {
        try {
            var psi = new ProcessStartInfo("netstat.exe", "-ano") {
                UseShellExecute = false,
                RedirectStandardOutput = true,
                CreateNoWindow = true,
            };
            var p = Process.Start(psi);
            string output = p.StandardOutput.ReadToEnd();
            p.WaitForExit();

            var seen = new HashSet<int>();
            foreach (string line in output.Split('\n')) {
                if (!line.Contains(":" + port + " ") && !line.Contains(":" + port + "\t")) continue;
                string[] parts = line.Trim().Split(new char[]{' ', '\t'}, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length == 0) continue;
                string pidStr = parts[parts.Length - 1];
                int pid;
                if (!int.TryParse(pidStr, out pid) || pid <= 0 || seen.Contains(pid)) continue;
                seen.Add(pid);
                try {
                    Process.GetProcessById(pid).Kill();
                    Console.WriteLine(" [OK] Port " + port + " libere (PID " + pid + ")");
                } catch {}
            }
        } catch {}
    }
}
