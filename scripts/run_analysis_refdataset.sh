#!/bin/bash
#
# run_analysis_refdataset.sh
#
# Purpose:
#   Run a soot-based analysis tool for changed methods across merge-commit builds.
#   For each merge commit directory under the specified project directory, the
#   script locates changed methods, finds the build artifacts containing the
#   classes, and runs several analysis modes for both left->right and right->left
#   change CSVs.
#
# Prerequisites:
#   - Bash (script is written for a Unix-like environment; WSL on Windows is OK).
#   - Java 8+ installed and available on PATH.
#   - The analysis JAR referenced by `ANALYSIS_PATH` must exist and be runnable.
#   - Project directories must follow the layout expected by this script:
#       <project-dir>/
#         <merge-commit>/
#           original-without-dependencies/merge/   <-- build output (jars)
#           changed-methods/
#             <fully.qualified.ClassName>/
#               <method-name>/
#                 left-right-lines.csv
#                 right-left-lines.csv
#
# Usage:
#   ./run_analysis_refdataset.sh <project-directory>
#
# Example:
#   ./run_analysis_refdataset.sh ~/ref-dataset/accumulo
#
# Environment:
#   - `ANALYSIS_PATH` points to the soot-analysis jar to run (adjust to your environment).
#
# Output / Side effects:
#   - The script invokes the analysis jar via `java -jar` for each CSV/mode combination.
#   - It prints progress and which jar/classpath is used for each class/method.
#
# Exit codes:
#   0   : success (script finishes iterating all commits)
#   1   : missing required argument (project directory)
#
# Notes:
#   - The script does not modify project files; it only reads CSVs and runs analysis.
#   - If a class is found inside one of the build jars, that jar is used as the classpath.
#   - If no jar is found, the script uses "$BUILD_DIR/*" as the classpath (all jars in the build dir).
#   - This script intentionally keeps behavior unchanged; only documentation and minor usage output were added.
#

ANALYSIS_PATH="" # /path/to/soot-analysis.jar

PROJECT_DIR=$1

if [ -z "$PROJECT_DIR" ]; then
    echo "Usage: $0 <project-directory>"
    exit 1
fi

# method for running the analysis in one commit
run_analysis() {
    local MERGE_COMMIT=$1

    echo "Running analysis for merge commit: $MERGE_COMMIT"

    BUILD_DIR="$PROJECT_DIR/$MERGE_COMMIT/original-without-dependencies/merge"
    CHANGED_METHODS_DIR="$PROJECT_DIR/$MERGE_COMMIT/changed-methods"

    # iterate over each class directory inside the changed-methods directory
    for class_dir in "$CHANGED_METHODS_DIR/"*/ ; do
        # get the directory name (class name)
        class_name=$(basename "$class_dir")

        # iterate over each method directory inside the class directory
        for method_dir in "$class_dir"*/ ; do
            # get the directory name (method name)
            method_name=$(basename "$method_dir")
            echo "Analyzing $class_name/$method_name"

            LEFT_RIGHT_CSV="$method_dir/left-right-lines.csv"
            RIGHT_LEFT_CSV="$method_dir/right-left-lines.csv"

            # The analysis will be run once for each mode:
            # 1. overriding-interprocedural
            # 2. dfp-inter
            # 3. dfp-confluence-interprocedural

            # default: use all jars in the build directory as the classpath
            echo "Using build directory: $BUILD_DIR"
            classpath="$BUILD_DIR/*"

            # search for .jar that has the class file path inside it; if found, use that jar alone
            for jar_file in "$BUILD_DIR"/*.jar ; do
                if jar tf "$jar_file" | grep -q "${class_name//./\/}" ; then
                    echo "Found class $class_name in $jar_file"
                    classpath="$jar_file"
                    break
                fi
            done

            # create the results directory if it doesn't exist
            project_name=$(basename "$PROJECT_DIR")
            RESULTS_DIR="results/$project_name/$MERGE_COMMIT/$class_name/$method_name"
            mkdir -p "$RESULTS_DIR"
            cd "$RESULTS_DIR" || { echo "Failed to change directory to $RESULTS_DIR"; exit 1; }

            # run the analysis for left-right changes in each mode
            for mode in "overriding-interprocedural" "dfp-inter" "dfp-confluence-interprocedural" ; do
                echo "Running $mode analysis for left-right changes"
                java -jar "$ANALYSIS_PATH" \
                    -cp "$classpath" \
                    -csv "$LEFT_RIGHT_CSV" \
                    -mode "$mode"
            done

            # save the left-right results before running right-left
            mkdir -p left-right
            mv *.txt *.csv *.json sootOutput/ left-right/ 2>/dev/null || true

            # run the analysis for right-left changes in each mode
            for mode in "overriding-interprocedural" "dfp-inter" "dfp-confluence-interprocedural" ; do
                echo "Running $mode analysis for right-left changes"
                java -jar "$ANALYSIS_PATH" \
                    -cp "$classpath" \
                    -csv "$RIGHT_LEFT_CSV" \
                    -mode "$mode"
            done

            # save the right-left results
            mkdir -p right-left
            mv *.txt *.csv *.json sootOutput/ right-left/ 2>/dev/null || true
        done
    done
}

# iterate over each merge commit directory in the project directory
for merge_commit_dir in "$PROJECT_DIR"/*/ ; do
    merge_commit=$(basename "$merge_commit_dir")
    run_analysis "$merge_commit"
done