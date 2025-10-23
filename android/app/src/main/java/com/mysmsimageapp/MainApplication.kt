package com.mysmsimageapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

import com.mysmsimageapp.MySmsPackage

class MainApplication : Application(), ReactApplication {

    override val reactHost: ReactHost by lazy {
        getDefaultReactHost(
            context = applicationContext,
            packageList = PackageList(this).packages.apply {
                add(MySmsPackage()) // register custom package
            }
        )
    }

    override fun onCreate() {
        super.onCreate()
        loadReactNative(this)
    }
}
