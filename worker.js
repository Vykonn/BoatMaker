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
await micropip.install("pymesh")
from pyodide.http import pyfetch
response = await pyfetch("https://raw.githubusercontent.com/noahbagz/ShipD/refs/heads/main/HullParameterization.py")
with open("HullParameterization.py", "wb") as f:
    f.write(await response.bytes())
`)
await pyodide.pyimport("HullParameterization");
postMessage(["startready", false])
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
        from numpy.linalg import norm
        import pymesh
        def fix_mesh(mesh, detail="normal"):
            bbox_min, bbox_max = mesh.bbox
            diag_len = norm(bbox_max - bbox_min)
            if detail == "normal":
                target_len = diag_len * 5e-3
            elif detail == "high":
                target_len = diag_len * 2.5e-3
            elif detail == "low":
                target_len = diag_len * 1e-2
            print("Target resolution: {} mm".format(target_len))
        
            count = 0
            mesh, __ = pymesh.remove_degenerated_triangles(mesh, 100)
            mesh, __ = pymesh.split_long_edges(mesh, target_len)
            num_vertices = mesh.num_vertices
            while True:
                mesh, __ = pymesh.collapse_short_edges(mesh, 1e-6)
                mesh, __ = pymesh.collapse_short_edges(mesh, target_len,
                                                       preserve_feature=True)
                mesh, __ = pymesh.remove_obtuse_triangles(mesh, 150.0, 100)
                if mesh.num_vertices == num_vertices:
                    break
        
                num_vertices = mesh.num_vertices
                print("#v: {}".format(num_vertices))
                count += 1
                if count > 10: break
        
            mesh = pymesh.resolve_self_intersection(mesh)
            mesh, __ = pymesh.remove_duplicated_faces(mesh)
            mesh = pymesh.compute_outer_hull(mesh)
            mesh, __ = pymesh.remove_duplicated_faces(mesh)
            mesh, __ = pymesh.remove_obtuse_triangles(mesh, 179.0, 5)
            mesh, __ = pymesh.remove_isolated_vertices(mesh)
        
            return mesh
        json_data = json.loads(string_data)
        values_array = np.array(list(json_data.values()))
        print(values_array)
        Hull = HP(values_array)
        constraints = Hull.input_Constraints()
        cons = constraints > 0
        print(sum(cons)) # should be zero
        mesh = Hull.gen_stl(NUM_WL=200, PointsPerWL=1000, bit_AddTransom = 1, bit_AddDeckLid = 1, namepath = "/mnt/mesh")
        mesh = pymesh.load_mesh("/mnt/mesh.stl")
        mesh = fix_mesh(mesh, detail="medium")
        pymesh.save_mesh("mesh2.stl", mesh, use_float=True)
        print(os.listdir('/mnt'))
        `)
        let result = pyodide.FS.readFile("/mnt/mesh2.stl", { encoding: "binary" });
        self.postMessage([result, "download"]);
        }
        catch(err) {
            let result = false
            self.postMessage([result, false]);
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
        console.log(result)
        console.log([result,false][0])
        self.postMessage([result, false]);
        }
        catch(err) {
            let result = false
            self.postMessage(result);
        }
    }

};
