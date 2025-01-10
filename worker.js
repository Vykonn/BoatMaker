import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.mjs";
let pyodide = await loadPyodide();
pyodide.FS.mkdirTree("/mnt");
pyodide.FS.mount(pyodide.FS.filesystems.IDBFS, {}, "/mnt");
await pyodide.loadPackage("micropip")
await pyodide.runPythonAsync(`
import micropip
await micropip.install("numpy")
await micropip.install("numpy-stl")
await micropip.install("matplotlib")
from pyodide.http import pyfetch
response = await pyfetch("https://raw.githubusercontent.com/noahbagz/ShipD/refs/heads/main/HullParameterization.py")
with open("HullParameterization.py", "wb") as f:
    f.write(await response.bytes())
`)
await pyodide.pyimport("HullParameterization");
postMessage("startready")
let currentTask;
self.onmessage = async (event) => {
    pyodide.globals.set("string_data", JSON.stringify(event.data[0]));
    if (event.data[1] == true) {
        try {
        console.log("Starting download render process!")
        pyodide.runPython(`
        import numpy as np
        import json
        import os
        from HullParameterization import Hull_Parameterization as HP
        json_data = json.loads(string_data)
        values_array = np.array(list(json_data.values()))
        print(values_array)
        Hull = HP(values_array)
        constraints = Hull.input_Constraints()
        cons = constraints > 0
        print(sum(cons)) # should be zero
        mesh = Hull.gen_stl(NUM_WL=200, PointsPerWL=1000, bit_AddTransom = 1, bit_AddDeckLid = 1, namepath = "/mnt/mesh")
        print(os.listdir('/mnt'))
        `)
        let result = pyodide.FS.readFile("/mnt/mesh.stl", { encoding: "binary" });
        self.postMessage([result, "download"]);
        }
        catch(err) {
            let result = false
            self.postMessage(result);
        }
    }
    else {
        try {
        pyodide.runPython(`
        import numpy as np
        import json
        import os
        from HullParameterization import Hull_Parameterization as HP
        json_data = json.loads(string_data)
        values_array = np.array(list(json_data.values()))
        print(values_array)
        Hull = HP(values_array)
        constraints = Hull.input_Constraints()
        cons = constraints > 0
        print(sum(cons)) # should be zero
        mesh = Hull.gen_stl(NUM_WL=50, PointsPerWL=400, bit_AddTransom = 1, bit_AddDeckLid = 1, namepath = "/mnt/mesh")
        print(os.listdir('/mnt'))
        `)
        let result = pyodide.FS.readFile("/mnt/mesh.stl", { encoding: "binary" });
        self.postMessage(result);
        }
        catch(err) {
            let result = false
            self.postMessage(result);
        }
    }

};
