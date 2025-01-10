# This script installs the language packs to the system so it only needs to be done once. This will be part of the Dockerfile setup later when this app is containerized, but i'm including it in the project just so that it's clearer how to set it up, how to get more languages, and to make clearer what is going on in the project's code.

import argostranslate.package

argostranslate.package.update_package_index()
available_packages = argostranslate.package.get_available_packages()

for package in available_packages:
    print(f'LANG: {package} \tFrom: {package.from_code} \t To: {package.to_code}')
    
packages_to_install = [
    # ['en', 'ca'], ['ca', 'en'],     # english - catalan
    # ['ar', 'en'], ['en', 'ar'],     # english - arabic
    ['en', 'fr'], ['fr', 'en'],     # english - french
    ['en', 'de'], ['de', 'en'],     # english - german
    # ['en', 'it'], ['it', 'en'],     # english - italian
    # ['en', 'pt'], ['pt', 'en'],     # english - portuguese
    ['en', 'ru'], ['ru', 'en'],     # english - russian
    ['en', 'es'], ['es', 'en'],     # english - spanish
    # ['en', 'tl'], ['tl', 'en'],     # english - tagalog (phillippines)
    ['en', 'uk'], ['uk', 'en']      # english - ukrainian
]

for lang_pair in packages_to_install:
    lang_from, lang_to = lang_pair
    try:
        package_to_install = next(
            pkg for pkg in available_packages if pkg.from_code == lang_from and pkg.to_code == lang_to
        )
        argostranslate.package.install_from_path(package_to_install.download())
        print(f"Installed package sucessfully!\n{lang_from} -> {lang_to}")
    except StopIteration:
        print(f"Package not found: {lang_from} -> {lang_to}")
    except:
        print("-"*25)
        print(f"Not sure what the problem is, check that these language packs installed successfully...")
        print(packages_to_install)
        print("-"*25)
    
